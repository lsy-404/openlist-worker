import { markRaw, reactive } from "vue"
import { makeZip } from "client-zip"
import { api, type FsEntry } from "@/api"
import { t } from "@/i18n"
import { fetchFile, fetchErrorMessage } from "@/previews/fetch"
import { passwordFor } from "@/stores/passwords"
import { entryDownloadUrl } from "@/utils/links"
import { joinPath } from "@/utils/path"

export type PackageStatus = "running" | "done" | "failed" | "cancelled"

export interface PackageItem {
  id: number
  /** Zip file name. */
  name: string
  /** Folder the selection was made in, in URL space. */
  dir: string
  size: number
  loaded: number
  /** Zip-relative path of the file being fetched. */
  current: string
  status: PackageStatus
  error: string
  controller: AbortController
  startedAt: number
  endedAt: number
}

interface ZipFile {
  rel: string
  url: string
  size: number
  modified: Date | undefined
}

interface Collected {
  files: ZipFile[]
  dirs: string[]
}

type SaveTarget = WritableStream<Uint8Array>
type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
  createWritable(): Promise<SaveTarget>
}>

const LIST_CONCURRENCY = 3
// Without the File System Access API the whole archive is held in memory
const BLOB_LIMIT = 1024 ** 3

export const packages = reactive<{ items: PackageItem[] }>({ items: [] })

let nextId = 1

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err))

function zipFile(dir: string, entry: FsEntry, rel: string): ZipFile {
  const time = Date.parse(entry.modified)
  return { rel, url: entryDownloadUrl(joinPath(dir, entry.name), entry.sign), size: entry.size, modified: Number.isNaN(time) ? undefined : new Date(time) }
}

async function collect(dir: string, entries: FsEntry[], signal: AbortSignal): Promise<Collected> {
  const out: Collected = { files: [], dirs: [] }
  const pending: { path: string; rel: string }[] = []
  const add = (parent: string, rel: string, list: FsEntry[]) => {
    for (const entry of list) {
      const name = rel ? `${rel}/${entry.name}` : entry.name
      if (entry.is_dir) pending.push({ path: joinPath(parent, entry.name), rel: name })
      else out.files.push(zipFile(parent, entry, name))
    }
  }
  add(dir, "", entries)
  const worker = async () => {
    for (let job = pending.pop(); job; job = pending.pop()) {
      const list = await api.fsList(job.path, passwordFor(job.path), { signal }).catch((err) => {
        throw signal.aborted ? err : new Error(t("files.package.listFailed", { path: job.rel, reason: reason(err) }))
      })
      if (!list.content?.length) out.dirs.push(job.rel)
      else add(job.path, job.rel, list.content)
    }
  }
  await Promise.all(Array.from({ length: LIST_CONCURRENCY }, worker))
  return out
}

async function* sources(item: PackageItem, { files, dirs }: Collected, signal: AbortSignal) {
  for (const dir of dirs) yield { name: `${dir}/` }
  for (const file of files) {
    signal.throwIfAborted()
    item.current = file.rel
    // A body that breaks mid-transfer must name its file as well
    const failure = (err: unknown) => (signal.aborted ? err : new Error(t("files.package.fetchFailed", { path: file.rel, reason: fetchErrorMessage(err) })))
    const res = await fetchFile(file.url, signal).catch((err) => {
      throw failure(err)
    })
    if (!res.body) throw failure(new Error("empty response"))
    yield { name: file.rel, lastModified: file.modified, input: counted(res.body.getReader(), item, failure) }
  }
}

async function* counted(reader: ReadableStreamDefaultReader<Uint8Array>, item: PackageItem, failure: (err: unknown) => unknown) {
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) return
      item.loaded += value.byteLength
      yield value
    }
  } catch (err) {
    throw failure(err)
  } finally {
    void reader.cancel().catch(() => undefined)
  }
}

// Response.blob() would replace the stream's own error with a generic network failure
async function toBlob(stream: ReadableStream<Uint8Array>): Promise<Blob> {
  const parts: Uint8Array[] = []
  const reader = stream.getReader()
  for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) parts.push(chunk.value)
  return new Blob(parts, { type: "application/zip" })
}

function saveBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function run(item: PackageItem, entries: FsEntry[], target: SaveTarget | null): Promise<void> {
  const { signal } = item.controller
  try {
    const collected = await collect(item.dir, entries, signal)
    item.size = collected.files.reduce((sum, file) => sum + file.size, 0)
    if (!target && item.size > BLOB_LIMIT) throw new Error(t("files.package.tooLarge"))
    const stream = makeZip(sources(item, collected, signal))
    if (target) await stream.pipeTo(target, { signal })
    else saveBlob(await toBlob(stream), item.name)
    item.status = "done"
  } catch (err) {
    item.status = signal.aborted ? "cancelled" : "failed"
    item.error = signal.aborted ? "" : reason(err)
    await target?.abort().catch(() => undefined)
  } finally {
    item.endedAt = Date.now()
  }
}

/**
 * Packs the entries of `dir` (folders recursively) into one zip. Must run inside the click handler:
 * the save dialog needs the user activation, so nothing may be awaited before it.
 */
export async function startPackage(dir: string, entries: FsEntry[], baseName: string): Promise<void> {
  const name = `${baseName.replace(/[\\/:*?"<>|]/g, "_")}.zip`
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker
  let target: SaveTarget | null = null
  if (picker) {
    try {
      const handle = await picker.call(window, { suggestedName: name, types: [{ description: "ZIP", accept: { "application/zip": [".zip"] } }] })
      target = await handle.createWritable()
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      throw err
    }
  }
  const item = reactive<PackageItem>({
    id: nextId++,
    name,
    dir,
    size: 0,
    loaded: 0,
    current: "",
    status: "running",
    error: "",
    controller: markRaw(new AbortController()),
    startedAt: Date.now(),
    endedAt: 0,
  })
  packages.items.push(item)
  await run(item, entries, target)
}

export function cancelPackage(item: PackageItem): void {
  if (item.status === "running") item.controller.abort()
}

export function clearFinishedPackages(): void {
  packages.items = packages.items.filter((item) => item.status === "running")
}
