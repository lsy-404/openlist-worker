import { onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { t } from "@/i18n"
import { proxyUrl } from "./download"

const AUTO_LOAD_LIMIT = 2 * 1024 * 1024

export type TextStatus = "loading" | "large" | "ready" | "error"

function decode(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return { text: new TextDecoder("utf-16le").decode(buffer), encoding: "UTF-16LE" }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return { text: new TextDecoder("utf-16be").decode(buffer), encoding: "UTF-16BE" }
  try {
    return { text: new TextDecoder("utf-8", { fatal: true }).decode(buffer), encoding: "UTF-8" }
  } catch {
    return { text: new TextDecoder("gbk").decode(buffer), encoding: "GBK" }
  }
}

export function useTextFile(source: () => { url: string; size: number }) {
  const status = ref<TextStatus>("loading")
  const text = shallowRef("")
  const encoding = ref("")
  const error = ref("")
  let controller: AbortController | null = null

  async function load(force = false) {
    controller?.abort()
    const current = (controller = new AbortController())
    const { url, size } = source()
    if (!force && size > AUTO_LOAD_LIMIT) {
      status.value = "large"
      return
    }
    status.value = "loading"
    try {
      // The proxy path keeps the request same-origin; the direct URL may redirect to a storage node
      const candidates = [proxyUrl(url), url].filter((u): u is string => !!u)
      let res: Response | null = null
      let failure: unknown = null
      for (const candidate of candidates) {
        try {
          const attempt = await fetch(candidate, { signal: current.signal })
          if (attempt.ok) {
            res = attempt
            break
          }
          failure = new Error(t("preview.text.serverStatus", { status: attempt.status }))
        } catch (err) {
          if (current.signal.aborted) return
          failure = err
        }
      }
      if (!res) throw failure
      const result = decode(await res.arrayBuffer())
      if (current.signal.aborted) return
      text.value = result.text
      encoding.value = result.encoding
      status.value = "ready"
    } catch (err) {
      if (current.signal.aborted) return
      error.value =
        err instanceof TypeError
          ? t("preview.text.blocked")
          : err instanceof Error
            ? err.message
            : String(err)
      status.value = "error"
    }
  }

  watch(() => source().url, () => void load(), { immediate: true })
  onBeforeUnmount(() => controller?.abort())

  return { status, text, encoding, error, load }
}
