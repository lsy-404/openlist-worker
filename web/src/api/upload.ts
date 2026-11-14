import { apiError, getToken } from "./http"
import type { ApiEnvelope } from "./types"

/** Whole-body uploads are capped by the Worker (MAX_UPLOAD, 25 MB by default); larger files try the chunked endpoints first. */
const CHUNKED_FROM = 20 * 1024 * 1024
const CHUNK_SIZE = 8 * 1024 * 1024

interface MultipartSession {
  upload_id: string
  chunk_size: number
  total_chunks: number
  received: [number, number][]
}

export interface UploadOptions {
  signal: AbortSignal
  onProgress(loaded: number): void
}

function send<T>(
  method: "PUT" | "POST",
  url: string,
  headers: Record<string, string>,
  body: Blob | null,
  opts: { signal: AbortSignal; onProgress?(loaded: number): void },
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (opts.signal.aborted) return reject(new DOMException("Aborted", "AbortError"))
    const xhr = new XMLHttpRequest()
    xhr.open(method, url)
    const token = getToken()
    if (token) xhr.setRequestHeader("Authorization", token)
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value)
    if (opts.onProgress) xhr.upload.onprogress = (e) => opts.onProgress!(e.loaded)
    const onAbort = () => xhr.abort()
    opts.signal.addEventListener("abort", onAbort, { once: true })
    const done = () => opts.signal.removeEventListener("abort", onAbort)

    xhr.onload = () => {
      done()
      let envelope: ApiEnvelope<T> | null = null
      try {
        envelope = JSON.parse(xhr.responseText) as ApiEnvelope<T>
      } catch {
        /* non-JSON response */
      }
      const code = envelope?.code ?? xhr.status
      if (!envelope || code !== 200) return reject(apiError(code, envelope?.message || xhr.statusText || "上传失败"))
      resolve(envelope.data)
    }
    xhr.onerror = () => {
      done()
      reject(apiError(0, "无法连接到服务器"))
    }
    xhr.onabort = () => {
      done()
      reject(new DOMException("Aborted", "AbortError"))
    }
    xhr.send(body)
  })
}

function putWhole(path: string, file: File, opts: UploadOptions): Promise<null> {
  return send<null>(
    "PUT",
    "/api/fs/put",
    { "File-Path": encodeURIComponent(path), "Content-Type": file.type || "application/octet-stream" },
    file,
    opts,
  )
}

async function putChunked(path: string, file: File, session: MultipartSession, opts: UploadOptions): Promise<void> {
  const size = session.chunk_size
  const have = new Set<number>()
  for (const [from, to] of session.received) for (let i = from; i <= to; i++) have.add(i)
  const lengthOf = (i: number) => Math.min(size, file.size - i * size)
  let base = 0
  for (const i of have) base += lengthOf(i)
  opts.onProgress(base)

  for (let i = 0; i < session.total_chunks; i++) {
    if (have.has(i)) continue
    const start = base
    await send<unknown>(
      "PUT",
      "/api/fs/multipart/chunk",
      { "X-Upload-Id": session.upload_id, "X-Chunk-Index": String(i), "Content-Type": "application/octet-stream" },
      file.slice(i * size, i * size + lengthOf(i)),
      { signal: opts.signal, onProgress: (loaded) => opts.onProgress(start + loaded) },
    )
    base += lengthOf(i)
    opts.onProgress(base)
  }
  await send<unknown>("POST", "/api/fs/multipart/complete", { "X-Upload-Id": session.upload_id }, null, {
    signal: opts.signal,
  })
}

export async function uploadFile(path: string, file: File, opts: UploadOptions): Promise<void> {
  if (file.size > CHUNKED_FROM) {
    // data: null means the storage has no chunked upload; fall through to the streamed PUT
    const session = await send<MultipartSession | null>(
      "POST",
      "/api/fs/multipart/init",
      { "File-Path": encodeURIComponent(path), "X-File-Size": String(file.size), "X-Chunk-Size": String(CHUNK_SIZE) },
      null,
      { signal: opts.signal },
    )
    if (session) return putChunked(path, file, session, opts)
  }
  await putWhole(path, file, opts)
  opts.onProgress(file.size)
}
