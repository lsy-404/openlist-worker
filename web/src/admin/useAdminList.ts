import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from "vue"
import { ApiError } from "@/api"

export interface AdminList<T> {
  rows: Ref<T[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  reload: () => Promise<void>
}

/** Loads a list on mount and on reload(); a newer load supersedes an older one. */
export function useAdminList<T>(fetcher: (signal: AbortSignal) => Promise<T[]>): AdminList<T> {
  const rows = shallowRef<T[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  let controller: AbortController | null = null

  async function reload() {
    controller?.abort()
    const mine = (controller = new AbortController())
    loading.value = true
    try {
      const result = await fetcher(mine.signal)
      if (controller !== mine) return
      rows.value = result
      error.value = null
    } catch (err) {
      if (controller !== mine) return
      error.value = err instanceof ApiError ? err.message : String(err)
    } finally {
      if (controller === mine) loading.value = false
    }
  }

  onMounted(reload)
  onBeforeUnmount(() => controller?.abort())
  return { rows: rows as Ref<T[]>, loading, error, reload }
}
