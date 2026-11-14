import { onBeforeUnmount, ref, shallowRef, watch, type Ref } from "vue"
import { api, ApiError, clearToken, getToken, type FsFile, type FsList } from "@/api"
import { forgetPassword, passwordFor, rememberPassword } from "@/stores/passwords"
import { loadUser } from "@/stores/session"

export type Resource =
  | { kind: "folder"; path: string; list: FsList }
  | { kind: "file"; path: string; file: FsFile }

async function fetchResource(path: string, password: string, refresh: boolean, signal: AbortSignal): Promise<Resource> {
  const opts = { signal, refresh }
  // Folder or file is unknown up front: list first, and fall back to the file lookup when the path is not a folder
  const meta = api.fsGet(path, password, opts)
  meta.catch(() => undefined)
  try {
    return { kind: "folder", path, list: await api.fsList(path, password, opts) }
  } catch (err) {
    if (!(err instanceof ApiError) || err.kind !== "server") throw err
    const file = await meta.catch(() => null)
    if (!file || file.is_dir) throw err
    return { kind: "file", path, file }
  }
}

export function useBrowse(path: Ref<string>) {
  const resource = shallowRef<Resource | null>(null)
  const loading = ref(true)
  const error = ref<ApiError | null>(null)
  const locked = ref(false)
  const wrongPassword = ref(false)
  const submitting = ref(false)
  let controller: AbortController | null = null

  async function load(opts: { refresh?: boolean; password?: string } = {}) {
    controller?.abort()
    const current = (controller = new AbortController())
    const target = path.value
    const supplied = opts.password !== undefined
    const password = opts.password ?? passwordFor(target)
    loading.value = true
    error.value = null
    if (!supplied) locked.value = false

    try {
      let result: Resource
      try {
        result = await fetchResource(target, password, !!opts.refresh, current.signal)
      } catch (err) {
        // A stale token must not block public content: drop it and retry as guest
        if (err instanceof ApiError && err.kind === "unauthorized" && getToken()) {
          clearToken()
          await loadUser()
          result = await fetchResource(target, "", !!opts.refresh, current.signal)
        } else {
          throw err
        }
      }
      if (current.signal.aborted) return
      if (supplied) rememberPassword(target, password)
      resource.value = result
      locked.value = false
      wrongPassword.value = false
    } catch (err) {
      if (current.signal.aborted) return
      resource.value = null
      if (err instanceof ApiError && err.kind === "forbidden") {
        // A saved password that no longer works is discarded so the dialog starts clean
        if (password && !supplied) forgetPassword(target)
        wrongPassword.value = supplied
        locked.value = true
      } else {
        error.value = err instanceof ApiError ? err : new ApiError("server", String(err), 0)
      }
    } finally {
      if (controller === current) {
        loading.value = false
        submitting.value = false
      }
    }
  }

  async function submitPassword(password: string) {
    submitting.value = true
    await load({ password })
  }

  watch(
    path,
    () => {
      wrongPassword.value = false
      void load()
    },
    { immediate: true },
  )
  onBeforeUnmount(() => controller?.abort())

  return { resource, loading, error, locked, wrongPassword, submitting, reload: () => load({ refresh: true }), submitPassword }
}
