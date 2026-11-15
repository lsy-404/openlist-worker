import { t } from "@/i18n"
import { proxyUrl } from "./download"

/**
 * Same-origin fetch of a file. The proxy path is tried first because the direct link may redirect
 * to a storage node that the page's security policy does not allow.
 */
export async function fetchFile(url: string, signal?: AbortSignal): Promise<Response> {
  const candidates = [proxyUrl(url), url].filter((u): u is string => !!u)
  let failure: unknown = null
  for (const candidate of candidates) {
    try {
      const res = await fetch(candidate, { signal })
      if (res.ok) return res
      failure = new Error(t("preview.text.serverStatus", { status: res.status }))
    } catch (err) {
      if (signal?.aborted) throw err
      failure = err
    }
  }
  throw failure
}

/** First of the proxy and direct URLs that answers a ranged request, for players that issue their own cross-origin-sensitive requests. */
export async function reachableUrl(url: string, signal?: AbortSignal): Promise<string> {
  for (const candidate of [proxyUrl(url), url]) {
    if (!candidate) continue
    try {
      const res = await fetch(candidate, { headers: { Range: "bytes=0-0" }, signal })
      void res.body?.cancel()
      if (res.ok) return candidate
    } catch {
      if (signal?.aborted) break
    }
  }
  return url
}

export async function fetchBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  return (await fetchFile(url, signal)).arrayBuffer()
}

export function fetchErrorMessage(err: unknown): string {
  return err instanceof TypeError ? t("preview.text.blocked") : err instanceof Error ? err.message : String(err)
}
