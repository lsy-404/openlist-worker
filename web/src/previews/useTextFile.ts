import { onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { fetchErrorMessage, fetchFile } from "./fetch"

const AUTO_LOAD_LIMIT = 2 * 1024 * 1024

export type TextStatus = "loading" | "large" | "ready" | "error"

export function decode(buffer: ArrayBuffer): { text: string; encoding: string } {
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
      const res = await fetchFile(url, current.signal)
      const result = decode(await res.arrayBuffer())
      if (current.signal.aborted) return
      text.value = result.text
      encoding.value = result.encoding
      status.value = "ready"
    } catch (err) {
      if (current.signal.aborted) return
      error.value = fetchErrorMessage(err)
      status.value = "error"
    }
  }

  watch(() => source().url, () => void load(), { immediate: true })
  onBeforeUnmount(() => controller?.abort())

  return { status, text, encoding, error, load }
}
