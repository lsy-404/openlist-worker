import { markRaw, reactive } from "vue"
import { api } from "@/api"
import { abortRemote, prepareUpload, uploadFile, type Prepared } from "@/api/upload"
import { t } from "@/i18n"
import { askConflict } from "@/stores/dialogs"
import { passwordFor } from "@/stores/passwords"
import { notify } from "@/stores/toast"
import { joinPath, splitPath } from "@/utils/path"

export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled"

export interface UploadItem {
  id: number
  /** Path relative to the target folder, shown in the queue. */
  name: string
  /** Folder the file is uploaded into, in URL space. */
  dir: string
  path: string
  file: File
  size: number
  loaded: number
  status: UploadStatus
  error: string
  batch: number
  controller: AbortController | null
  /** Folders and multipart session prepared while the item waits in the queue. */
  prep: Preparation | null
  /** "finishing" once all bytes are on the server and the storage is still writing the file. */
  phase: "sending" | "finishing"
  /** Storage write progress (0 to 100) while finishing, null until the storage reports it. */
  stored: number | null
  /** Epoch milliseconds when the upload was queued or last retried. */
  startedAt: number
  /** Epoch milliseconds when it reached a final state, 0 while pending. */
  endedAt: number
}

interface Preparation {
  controller: AbortController
  /** Never rejects; null when preparation failed and the upload prepares again itself. */
  ready: Promise<Prepared | null>
}

export interface UploadSource {
  file: File
  /** Slash-separated path below the target folder, ending in the file name. */
  relPath: string
}

export interface UploadSelection {
  files: UploadSource[]
  /** Folders to create even when they contain no files. */
  dirs: string[]
}

const CONCURRENCY = 6
/** Queued items whose folders and multipart session are prepared ahead of their turn. */
const PREPARE_AHEAD = 4

export const uploads = reactive<{ items: UploadItem[]; expanded: boolean }>({ items: [], expanded: true })

let nextId = 1
let nextBatch = 1
const dirJobs = new Map<string, Promise<void>>()
const batchDirs = new Map<number, string>()
const listeners = new Set<(dir: string) => void>()

/** Called with the target folder once every upload of a batch has finished and at least one succeeded. */
export function onUploadSettled(listener: (dir: string) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const active = () => uploads.items.filter((i) => i.status === "uploading").length
export const pending = () => uploads.items.filter((i) => i.status === "queued" || i.status === "uploading").length

function ensureDir(path: string): Promise<void> {
  let job = dirJobs.get(path)
  if (!job) {
    // An existing folder is fine; a real failure surfaces when the file itself is written
    job = api.fsMkdir(path).then(
      () => undefined,
      () => undefined,
    )
    dirJobs.set(path, job)
  }
  return job
}

async function prepareDirs(item: UploadItem): Promise<void> {
  const parts = splitPath(item.name).slice(0, -1)
  let current = item.dir
  for (const part of parts) {
    current = joinPath(current, part)
    await ensureDir(current)
  }
}

function settleBatch(batch: number): void {
  if (uploads.items.some((i) => i.batch === batch && (i.status === "queued" || i.status === "uploading"))) return
  const dir = batchDirs.get(batch)
  batchDirs.delete(batch)
  if (dir === undefined) return
  if (uploads.items.some((i) => i.batch === batch && i.status === "done")) listeners.forEach((fn) => fn(dir))
}

function prepareAhead(item: UploadItem): void {
  const controller = new AbortController()
  const ready = prepareDirs(item)
    .then(() => prepareUpload(item.path, item.file, controller.signal))
    .catch(() => null)
  item.prep = markRaw({ controller, ready })
}

function dropPreparation(item: UploadItem): void {
  const prep = item.prep
  item.prep = null
  if (!prep) return
  prep.controller.abort()
  void prep.ready.then((p) => p?.session && abortRemote(p.session))
}

async function run(item: UploadItem): Promise<void> {
  const prep = item.prep
  item.prep = null
  const controller = prep?.controller ?? markRaw(new AbortController())
  item.controller = controller
  item.status = "uploading"
  item.error = ""
  item.loaded = 0
  item.phase = "sending"
  item.stored = null
  try {
    const prepared = prep ? await prep.ready : null
    if (!prep) await prepareDirs(item)
    await uploadFile(item.path, item.file, {
      signal: controller.signal,
      prepared: prepared ?? undefined,
      onProgress: (loaded) => (item.loaded = Math.min(loaded, item.size)),
      onPhase: (phase) => (item.phase = phase),
      onStored: (percent) => (item.stored = percent),
    })
    item.loaded = item.size
    item.status = "done"
  } catch (err) {
    if (controller.signal.aborted) {
      item.status = "cancelled"
    } else {
      item.status = "failed"
      item.error = err instanceof Error ? err.message : String(err)
    }
  } finally {
    item.controller = null
    item.endedAt = Date.now()
    pump()
    settleBatch(item.batch)
  }
}

function pump(): void {
  for (const item of uploads.items) {
    if (active() >= CONCURRENCY) break
    if (item.status === "queued") void run(item)
  }
  let ahead = 0
  for (const item of uploads.items) {
    if (item.status !== "queued") continue
    if (ahead++ >= PREPARE_AHEAD) break
    if (!item.prep) prepareAhead(item)
  }
}

export function cancelUpload(item: UploadItem): void {
  if (item.status === "queued") {
    dropPreparation(item)
    item.status = "cancelled"
    item.endedAt = Date.now()
    settleBatch(item.batch)
  } else if (item.status === "uploading") item.controller?.abort()
}

export function cancelAll(): void {
  uploads.items.forEach(cancelUpload)
}

export function retryUpload(item: UploadItem): void {
  if (item.status !== "failed" && item.status !== "cancelled") return
  dropPreparation(item)
  item.status = "queued"
  item.error = ""
  item.loaded = 0
  item.startedAt = Date.now()
  item.endedAt = 0
  if (!batchDirs.has(item.batch)) batchDirs.set(item.batch, item.dir)
  pump()
}

export function clearFinished(): void {
  uploads.items = uploads.items.filter((i) => i.status === "queued" || i.status === "uploading")
  if (!uploads.items.length) dirJobs.clear()
}

/** Which of the sources already exist under `dir`, checking only the folders that can contain them. */
async function findConflicts(dir: string, sources: UploadSource[]): Promise<Set<string>> {
  const listings = new Map<string, Promise<Map<string, boolean> | null>>()
  const listing = (path: string) => {
    let job = listings.get(path)
    if (!job) {
      job = api.fsList(path, passwordFor(path)).then(
        (list) => new Map((list.content ?? []).map((e) => [e.name, e.is_dir])),
        () => null,
      )
      listings.set(path, job)
    }
    return job
  }

  const found = new Set<string>()
  await Promise.all(
    sources.map(async ({ relPath }) => {
      const parts = splitPath(relPath)
      let current = dir
      for (let i = 0; i < parts.length; i++) {
        const entries = await listing(current)
        const hit = entries?.get(parts[i])
        if (hit === undefined) return
        if (i === parts.length - 1) {
          found.add(relPath)
          return
        }
        if (!hit) return
        current = joinPath(current, parts[i])
      }
    }),
  )
  return found
}

export async function enqueueUploads(dir: string, selection: UploadSelection): Promise<void> {
  let sources = selection.files
  if (sources.length) {
    const conflicts = await findConflicts(dir, sources)
    if (conflicts.size) {
      const overwrite = await askConflict([...conflicts])
      if (overwrite === null) return
      if (!overwrite) sources = sources.filter((s) => !conflicts.has(s.relPath))
    }
  }

  const batch = nextBatch++
  for (const rel of selection.dirs) await ensureDir(joinPath(dir, rel))

  const items = sources.map<UploadItem>(({ file, relPath }) => ({
    id: nextId++,
    name: relPath,
    dir,
    path: joinPath(dir, relPath),
    file: markRaw(file),
    size: file.size,
    loaded: 0,
    status: "queued",
    error: "",
    batch,
    controller: null,
    prep: null,
    phase: "sending",
    stored: null,
    startedAt: Date.now(),
    endedAt: 0,
  }))
  if (!items.length) {
    if (selection.dirs.length) listeners.forEach((fn) => fn(dir))
    else notify(t("files.notices.nothingToUpload"), "info")
    return
  }
  batchDirs.set(batch, dir)
  uploads.items.push(...items)
  uploads.expanded = true
  pump()
}
