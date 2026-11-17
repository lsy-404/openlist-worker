import { t } from "@/i18n"
import { apiError, getToken } from "./http"
import type { ApiEnvelope } from "./types"

/** Files up to one chunk go in a single request; anything larger tries the chunked endpoints first. */
const CHUNK_SIZE = 8 * 1024 * 1024
/** Chunks in flight at once; the node reassembles within a window of 8 chunks. */
const INFLIGHT = 3
/** Data-carrying requests in flight across all uploads, so the browser's per-host connections are not exhausted. */
const TRANSFER_SLOTS = 6
/** A prepared session older than this is re-initialised; an idle session may have been evicted server-side. */
const PREPARED_MAX_AGE = 2 * 60 * 1000
const MAX_ATTEMPTS = 6
/** Flow control (429/409) is not a failure, so it gets a much larger budget than errors. */
const MAX_FLOW_RETRIES = 400

export interface MultipartSession {
  upload_id: string
  chunk_size: number
  total_chunks: number
  received: [number, number][]
  state?: string
  error?: string
  /** How far the storage is with writing the file, 0 to 100. */
  storage_progress?: number
}

/** Result of the init step; session is null for small files and for storages without chunked upload. */
export interface Prepared {
  session: MultipartSession | null
  at: number
}

export interface UploadOptions {
  signal: AbortSignal
  onProgress(loaded: number): void
  /** Result of an earlier prepareUpload for the same path and file. */
  prepared?: Prepared
  /** Called with "finishing" once every byte has reached the server and the storage is still writing. */
  onPhase?(phase: "sending" | "finishing"): void
  /** Storage write progress (0 to 100) while finishing, for storages that report it. */
  onStored?(percent: number): void
}

const aborted = () => new DOMException("Aborted", "AbortError")

let freeSlots = TRANSFER_SLOTS
const slotWaiters: (() => void)[] = []

function releaseSlot(): void {
  const next = slotWaiters.shift()
  if (next) next()
  else freeSlots++
}

function acquireSlot(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(aborted())
  if (freeSlots > 0) {
    freeSlots--
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const grant = () => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }
    const onAbort = () => {
      slotWaiters.splice(slotWaiters.indexOf(grant), 1)
      reject(aborted())
    }
    slotWaiters.push(grant)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

async function withSlot<T>(signal: AbortSignal, task: () => Promise<T>): Promise<T> {
  await acquireSlot(signal)
  try {
    return await task()
  } finally {
    releaseSlot()
  }
}

function send<T>(
  method: "GET" | "PUT" | "POST",
  url: string,
  headers: Record<string, string>,
  body: Blob | null,
  opts: { signal: AbortSignal; onProgress?(loaded: number): void },
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (opts.signal.aborted) return reject(aborted())
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
      if (code === 413) return reject(apiError(code, t("errors.uploadTooLarge")))
      if (!envelope || code !== 200) return reject(apiError(code, envelope?.message || xhr.statusText || t("errors.uploadFailed")))
      resolve(envelope.data)
    }
    xhr.onerror = () => {
      done()
      reject(apiError(0, t("errors.network")))
    }
    xhr.onabort = () => {
      done()
      reject(aborted())
    }
    xhr.send(body)
  })
}

function putWhole(path: string, file: File, opts: UploadOptions): Promise<null> {
  return withSlot(opts.signal, () =>
    send<null>(
      "PUT",
      "/api/fs/put",
      { "File-Path": encodeURIComponent(path), "Content-Type": file.type || "application/octet-stream" },
      file,
      opts,
    ),
  )
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(aborted())
    const onAbort = () => {
      clearTimeout(timer)
      reject(aborted())
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort)
      resolve()
    }, ms)
    signal.addEventListener("abort", onAbort, { once: true })
  })
}

const codeOf = (err: unknown) => (err as { code?: number }).code ?? 0
const isFlowControl = (err: unknown) => codeOf(err) === 429 || codeOf(err) === 409
const isTransient = (err: unknown) => {
  const code = codeOf(err)
  return code === 0 || code === 408 || code >= 500
}

async function sendChunk(
  session: MultipartSession,
  index: number,
  blob: Blob,
  opts: { signal: AbortSignal; onProgress(loaded: number): void },
): Promise<void> {
  let failures = 0
  let flow = 0
  for (;;) {
    try {
      await withSlot(opts.signal, () =>
        send<MultipartSession>(
          "PUT",
          "/api/fs/multipart/chunk",
          { "X-Upload-Id": session.upload_id, "X-Chunk-Index": String(index), "Content-Type": "application/octet-stream" },
          blob,
          opts,
        ),
      )
      return
    } catch (err) {
      if (opts.signal.aborted) throw aborted()
      opts.onProgress(0)
      if (isFlowControl(err)) {
        if (++flow > MAX_FLOW_RETRIES) throw apiError(codeOf(err), t("errors.uploadStalled"))
        await sleep(800, opts.signal)
      } else if (isTransient(err) && ++failures < MAX_ATTEMPTS) {
        await sleep(Math.min(500 * 2 ** failures, 8000), opts.signal)
      } else throw err
    }
  }
}

/** Waits for the storage to finish writing; the complete request can outlive a proxy timeout, so the session is polled as well. */
async function finish(session: MultipartSession, opts: UploadOptions): Promise<void> {
  const status = () =>
    send<MultipartSession | null>(
      "GET",
      `/api/fs/multipart/status?upload_id=${encodeURIComponent(session.upload_id)}`,
      {},
      null,
      { signal: opts.signal },
    )
  let settled: "done" | Error | null = null
  void send<unknown>("POST", "/api/fs/multipart/complete", { "X-Upload-Id": session.upload_id }, null, {
    signal: opts.signal,
  }).then(
    () => (settled = "done"),
    (err) => {
      // a lost response (proxy timeout, network) is resolved by the polling below
      if (!opts.signal.aborted && !isTransient(err) && codeOf(err) !== 404) settled = err
    },
  )
  for (;;) {
    await sleep(2000, opts.signal)
    if (settled === "done") return
    if (settled) throw settled
    try {
      const snap = await status()
      if (typeof snap?.storage_progress === "number") opts.onStored?.(snap.storage_progress)
      if (snap?.state === "completed") return
      if (snap?.state?.startsWith("failed") || snap?.state === "aborted") {
        throw apiError(500, snap.error || t("errors.uploadFailed"))
      }
    } catch (err) {
      if (opts.signal.aborted) throw aborted()
      // a finished session is reaped, so 404 after the last chunk means it succeeded
      if (codeOf(err) === 404) return
      if (!isTransient(err)) throw err
    }
  }
}

export function abortRemote(session: MultipartSession): void {
  const token = getToken()
  void fetch("/api/fs/multipart/abort", {
    method: "POST",
    headers: { "X-Upload-Id": session.upload_id, ...(token ? { Authorization: token } : {}) },
    keepalive: true,
  }).catch(() => {})
}

async function putChunked(file: File, session: MultipartSession, opts: UploadOptions): Promise<void> {
  const size = session.chunk_size
  const lengthOf = (i: number) => Math.min(size, file.size - i * size)
  const have = new Set<number>()
  for (const [from, to] of session.received ?? []) for (let i = from; i <= to; i++) have.add(i)
  const missing: number[] = []
  for (let i = 0; i < session.total_chunks; i++) if (!have.has(i)) missing.push(i)

  let acked = 0
  for (const i of have) acked += lengthOf(i)
  const inflight = new Map<number, number>()
  let peak = acked
  const report = () => {
    let sum = acked
    for (const v of inflight.values()) sum += v
    // a retried chunk drops out of the sum briefly; progress holds instead of moving backwards
    peak = Math.max(peak, Math.min(sum, file.size))
    opts.onProgress(peak)
  }
  report()

  // one failed chunk stops its siblings instead of letting them upload on
  const stop = new AbortController()
  const relay = () => stop.abort()
  opts.signal.addEventListener("abort", relay, { once: true })

  const sendOne = async (i: number) => {
    await sendChunk(session, i, file.slice(i * size, i * size + lengthOf(i)), {
      signal: stop.signal,
      onProgress: (loaded) => {
        inflight.set(i, loaded)
        report()
      },
    })
    inflight.delete(i)
    acked += lengthOf(i)
    report()
  }

  try {
    let next = 0
    // a retriable failed session restarts only when chunk 0 arrives, so that chunk goes alone first
    if (session.state === "failed_retriable" && missing.length) await sendOne(missing[next++])
    const worker = async () => {
      try {
        while (next < missing.length) await sendOne(missing[next++])
      } catch (err) {
        stop.abort()
        throw err
      }
    }
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(INFLIGHT, missing.length - next) }, worker),
    )
    // the first real failure wins over the aborts it caused in the other workers
    const failure = results.find(
      (r): r is PromiseRejectedResult => r.status === "rejected" && !(r.reason instanceof DOMException),
    )
    if (failure) throw failure.reason
    if (opts.signal.aborted) throw aborted()
    opts.onPhase?.("finishing")
    await finish(session, opts)
  } catch (err) {
    if (opts.signal.aborted) abortRemote(session)
    throw err
  } finally {
    opts.signal.removeEventListener("abort", relay)
  }
}

/** Starts the chunked session early; session is null when the file is small or the storage has no chunked upload. */
export async function prepareUpload(path: string, file: File, signal: AbortSignal): Promise<Prepared> {
  if (file.size <= CHUNK_SIZE) return { session: null, at: Date.now() }
  const session = await send<MultipartSession | null>(
    "POST",
    "/api/fs/multipart/init",
    { "File-Path": encodeURIComponent(path), "X-File-Size": String(file.size), "X-Chunk-Size": String(CHUNK_SIZE) },
    null,
    { signal },
  )
  return { session, at: Date.now() }
}

export async function uploadFile(path: string, file: File, opts: UploadOptions): Promise<void> {
  opts.onPhase?.("sending")
  let prepared = opts.prepared
  if (prepared?.session && opts.signal.aborted) {
    abortRemote(prepared.session)
    throw aborted()
  }
  if (!prepared || (prepared.session && Date.now() - prepared.at > PREPARED_MAX_AGE)) {
    const stale = prepared?.session
    prepared = await prepareUpload(path, file, opts.signal)
    if (stale && stale.upload_id !== prepared.session?.upload_id) abortRemote(stale)
  }
  const { session } = prepared
  if (session) {
    if (session.state !== "completed") await putChunked(file, session, opts)
    return opts.onProgress(file.size)
  }
  await putWhole(path, file, opts)
  opts.onProgress(file.size)
}
