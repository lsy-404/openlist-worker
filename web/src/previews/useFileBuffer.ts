import { onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { fetchBuffer, fetchErrorMessage } from "./fetch"

const DEFAULT_LIMIT = 50 * 1024 * 1024

export type BufferStatus = "loading" | "large" | "ready" | "error"

/** Loads a whole file into memory for viewers that parse it client-side. */
export function useFileBuffer(source: () => { url: string; size: number }, limit = DEFAULT_LIMIT) {
  const status = ref<BufferStatus>("loading")
  const buffer = shallowRef<ArrayBuffer | null>(null)
  const error = ref("")
  let controller: AbortController | null = null

  async function load(force = false) {
    controller?.abort()
    const current = (controller = new AbortController())
    const { url, size } = source()
    buffer.value = null
    if (!force && size > limit) {
      status.value = "large"
      return
    }
    status.value = "loading"
    try {
      const data = await fetchBuffer(url, current.signal)
      if (current.signal.aborted) return
      buffer.value = data
      status.value = "ready"
    } catch (err) {
      if (current.signal.aborted) return
      error.value = fetchErrorMessage(err)
      status.value = "error"
    }
  }

  watch(() => source().url, () => void load(), { immediate: true })
  onBeforeUnmount(() => controller?.abort())

  return { status, buffer, error, load }
}
