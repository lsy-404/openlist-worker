import { resolvePath } from "../model/db"
import { getDriver } from "../op/storage"
import type { FileItem, StorageDriver } from "../driver/base"
import { getTrustedHosts } from "../../pkg/http"
import { safeProxyFetch } from "../../server/raw"

/** Targets that cannot stream an upload get the file buffered in memory, so keep this well under the 128 MB isolate limit. */
export const MAX_BUFFERED_BYTES = 32 * 1024 * 1024

export interface Mount {
  path: string
  storage: any
  physical: string
  driver: StorageDriver
}

export async function resolveMount(path: string, env: any): Promise<Mount> {
  const resolved = await resolvePath(path, env)
  if (resolved.isVirtual || !resolved.storage) {
    throw new Error(`${path} is not inside a mounted storage`)
  }
  const driver = await getDriver(resolved.storage.driver, resolved.storage)
  return { path, storage: resolved.storage, physical: resolved.physical!, driver }
}

export class NotFoundError extends Error {}

/** Lists a folder; a missing folder is reported as NotFoundError so callers can tell it apart from failures. */
export async function listMount(path: string, env: any): Promise<FileItem[]> {
  const m = await resolveMount(path, env)
  try {
    return await m.driver.list(path, m.physical)
  } catch (e: any) {
    const msg = String(e?.message || e)
    if (/not ?found|no such|does not exist|object not found|404/i.test(msg)) throw new NotFoundError(msg)
    throw e
  }
}

function nodeKeyOf(m: Mount): string | null {
  const key = (m.driver as any).nodeKey
  return typeof key === "string" && typeof (m.driver as any).serverCopy === "function" ? key : null
}

const parentOf = (p: string) => p.slice(0, p.lastIndexOf("/")) || "/"
const nameOf = (p: string) => p.slice(p.lastIndexOf("/") + 1)

/** True when both paths sit on the same remote node, which can then copy without the Worker relaying bytes. */
export async function sameNode(srcPath: string, dstPath: string, env: any): Promise<boolean> {
  const [s, d] = await Promise.all([resolveMount(srcPath, env), resolveMount(dstPath, env)])
  const a = nodeKeyOf(s)
  return a !== null && a === nodeKeyOf(d)
}

export async function serverCopy(srcPath: string, dstPath: string, env: any): Promise<void> {
  const [s, d] = await Promise.all([resolveMount(srcPath, env), resolveMount(dstPath, env)])
  if (nameOf(s.physical) !== nameOf(d.physical)) throw new Error("server-side copy cannot rename")
  await (s.driver as any).serverCopy(parentOf(s.physical), parentOf(d.physical), [nameOf(s.physical)])
}

async function openSource(m: Mount, env: any, signal: AbortSignal): Promise<ReadableStream> {
  const item = await m.driver.get(m.path, m.physical)
  if (item.raw_url) {
    let base: string | undefined
    try {
      base = JSON.parse(m.storage.addition || "{}").url || undefined
    } catch {}
    const res = await safeProxyFetch(
      new URL(item.raw_url, base).toString(),
      item.raw_url_headers || {},
      getTrustedHosts(m.storage.addition, env),
    )
    if (!res.ok || !res.body) throw new Error(`source download failed: HTTP ${res.status}`)
    if (signal.aborted) throw new Error("aborted")
    return res.body
  }
  const stream = (m.driver as any).createReadStream
  if (typeof stream === "function") return stream.call(m.driver, m.physical)
  throw new Error("source storage provides neither a download link nor a readable stream")
}

/**
 * Errors the stream when the source sends more or fewer bytes than listed, so a changed or
 * truncated file fails cleanly instead of tripping the target's fixed-length upload.
 */
function exactLength(stream: ReadableStream<Uint8Array>, size: number): ReadableStream<Uint8Array> {
  let seen = 0
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        seen += chunk.byteLength
        if (seen > size) controller.error(new Error(`source sent more than the listed ${size} bytes; the file changed during sync`))
        else controller.enqueue(chunk)
      },
      flush(controller) {
        if (seen !== size) controller.error(new Error(`source sent ${seen} of the listed ${size} bytes; the file changed or the download was cut`))
      },
    }),
  )
}

/** Relays one file from source to target through the Worker; returns the transfer mode used. */
export async function relayFile(
  srcPath: string,
  dstPath: string,
  size: number,
  modified: string,
  env: any,
  signal: AbortSignal,
): Promise<"stream" | "buffer"> {
  const [s, d] = await Promise.all([resolveMount(srcPath, env), resolveMount(dstPath, env)])
  const putStream = (d.driver as any).putStream
  if (typeof putStream !== "function" && size > MAX_BUFFERED_BYTES) {
    throw new Error(
      `target storage (${d.storage.driver}) cannot take streamed uploads and the file exceeds the ${MAX_BUFFERED_BYTES / 1048576} MiB in-memory limit`,
    )
  }
  const body = exactLength(await openSource(s, env, signal), size)
  if (typeof putStream === "function") {
    await putStream.call(d.driver, d.physical, body, size, modified, signal)
    return "stream"
  }
  const buf = new Uint8Array(await new Response(body).arrayBuffer())
  await d.driver.put(dstPath, d.physical, buf)
  return "buffer"
}

export async function statMount(path: string, env: any): Promise<FileItem | null> {
  const m = await resolveMount(path, env)
  try {
    return await m.driver.get(path, m.physical)
  } catch {
    return null
  }
}

export async function removeMount(path: string, env: any): Promise<void> {
  const m = await resolveMount(path, env)
  await m.driver.remove(path, m.physical, [nameOf(path)])
}

export async function mkdirMount(path: string, env: any): Promise<void> {
  const m = await resolveMount(path, env)
  await m.driver.mkdir(path, m.physical)
}
