import { flushPendingDriverState, getDriver } from "../internal/op/storage"
import { resolvePath } from "../internal/model/db"
import { NodeUploadError } from "../drivers/alist_v3/driver"
import { hmacSha256 } from "../pkg/crypto"
import { getActualPath } from "../pkg/permission"
import { getUploadSizeLimit, tooLargeResponse } from "../pkg/upload-limit"
import { getJwtSecret } from "./middlewares"

/**
 * Chunked upload for AListV3 mounts: the Worker holds no session state. The upload id it hands
 * to the browser is a signed envelope around the node's own id, so any isolate can serve any chunk.
 */

const PREFIX = "ol1."

interface NodeUploadRef {
  /** owner user id */
  u: number
  /** virtual directory the file is uploaded into, relative to the user's root */
  d: string
  /** node upload id */
  i: string
  /** browser-facing path */
  p: string
}

const b64u = (s: string) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
const unb64u = (s: string) =>
  new TextDecoder().decode(
    Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (ch) => ch.charCodeAt(0)),
  )

export const isNodeUploadId = (id: string) => id.startsWith(PREFIX)

async function seal(c: any, ref: NodeUploadRef): Promise<string> {
  const body = b64u(JSON.stringify(ref))
  return `${PREFIX}${body}.${await hmacSha256(body, await getJwtSecret(c))}`
}

async function open(c: any, id: string, user: any): Promise<NodeUploadRef | null> {
  const [body, sig] = id.slice(PREFIX.length).split(".")
  if (!body || !sig) return null
  if ((await hmacSha256(body, await getJwtSecret(c))) !== sig) return null
  try {
    const ref = JSON.parse(unb64u(body)) as NodeUploadRef
    return ref.u === user?.id ? ref : null
  } catch {
    return null
  }
}

async function nodeDriver(user: any, ref: NodeUploadRef) {
  const resolved = await resolvePath(getActualPath(user, ref.d))
  if (resolved.isVirtual || !resolved.storage) throw new Error("failed get storage: storage not found")
  const driver = (await getDriver(resolved.storage.driver, resolved.storage)) as any
  if (typeof driver.multipartChunk !== "function") throw new Error("storage does not support chunked upload")
  return { driver, resolved }
}

const notFound = (c: any) => c.json({ code: 404, message: "upload session not found", data: null }, 404)

function failure(c: any, e: any) {
  if (e instanceof NodeUploadError) {
    // 401/403 from the node are about the Worker's own credentials, never the browser's login
    const status = e.code === 401 ? 503 : e.code >= 400 && e.code < 600 ? e.code : 502
    return c.json({ code: status, message: e.code === 401 ? "node login refreshed, retry" : e.message, data: e.data ?? null }, status)
  }
  return c.json({ code: 502, message: e?.message || "upstream failure", data: null }, 502)
}

function snapshot(id: string, rawPath: string, snap: any) {
  return { ...snap, upload_id: id, path: rawPath }
}

/** Returns null when the mount is not an AListV3 node or the node has no chunked upload. */
export async function nodeMultipartInit(
  c: any,
  user: any,
  args: { rawPath: string; dir: string; name: string; actualDir: string; size: number; chunkSize: number },
) {
  const resolved = await resolvePath(args.actualDir)
  if (resolved.isVirtual || !resolved.storage) return undefined
  const driver = (await getDriver(resolved.storage.driver, resolved.storage)) as any
  if (typeof driver.multipartInit !== "function") return undefined
  const extra: Record<string, string> = {}
  for (const h of ["Overwrite", "Last-Modified", "X-File-Md5", "X-File-Sha1", "X-File-Sha256", "Content-Type"]) {
    const v = c.req.header(h)
    if (v) extra[h] = v
  }
  const physicalFile = `${resolved.physical!.replace(/\/+$/, "")}/${args.name}`
  try {
    const snap = await driver.multipartInit(physicalFile, args.size, args.chunkSize, extra)
    if (!snap) return null
    const id = await seal(c, { u: user.id, d: args.dir, i: snap.upload_id, p: args.rawPath })
    return c.json({ code: 200, message: "success", data: snapshot(id, args.rawPath, snap) })
  } catch (e) {
    return failure(c, e)
  } finally {
    await flushPendingDriverState(resolved.storage.driver, resolved.storage, driver)
  }
}

export async function nodeMultipartChunk(c: any, user: any, id: string, index: number) {
  const ref = await open(c, id, user)
  if (!ref) return notFound(c)
  const length = parseInt(c.req.header("Content-Length") || "", 10)
  if (!Number.isFinite(length) || length <= 0) {
    return c.json({ code: 411, message: "Content-Length required", data: null }, 411)
  }
  const max = getUploadSizeLimit(c, true)
  if (length > max) return tooLargeResponse(c, max, "Part")
  const body = c.req.raw.body
  if (!body) return c.json({ code: 400, message: "empty chunk", data: null }, 400)
  try {
    const { driver } = await nodeDriver(user, ref)
    const snap = await driver.multipartChunk(ref.i, index, body, length, c.req.raw.signal)
    return c.json({ code: 200, message: "success", data: snapshot(id, ref.p, snap) })
  } catch (e) {
    return failure(c, e)
  }
}

export async function nodeMultipartComplete(c: any, user: any, id: string) {
  const ref = await open(c, id, user)
  if (!ref) return notFound(c)
  try {
    const { driver } = await nodeDriver(user, ref)
    const snap = await driver.multipartComplete(ref.i)
    return c.json({ code: 200, message: "success", data: snapshot(id, ref.p, snap) })
  } catch (e) {
    return failure(c, e)
  }
}

export async function nodeMultipartStatus(c: any, user: any, id: string) {
  const ref = await open(c, id, user)
  if (!ref) return notFound(c)
  try {
    const { driver } = await nodeDriver(user, ref)
    const snap = await driver.multipartStatus(ref.i)
    return c.json({ code: 200, message: "success", data: snapshot(id, ref.p, snap) })
  } catch (e) {
    return failure(c, e)
  }
}

export async function nodeMultipartAbort(c: any, user: any, id: string) {
  const ref = await open(c, id, user)
  if (!ref) return notFound(c)
  try {
    const { driver } = await nodeDriver(user, ref)
    await driver.multipartAbort(ref.i)
    return c.json({ code: 200, message: "success", data: null })
  } catch (e) {
    return failure(c, e)
  }
}
