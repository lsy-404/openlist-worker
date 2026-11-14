const TAKEOVER_MS = 2000
const STALLED = Symbol("stalled")

/**
 * 等待另一个请求发起的共享 Promise；它的 I/O 会随那个请求被取消而永不落定，
 * 超时后由当前请求自己重做并接管缓存。
 */
export async function sharedOrOwn<T>(
  existing: Promise<T> | undefined | null,
  start: () => Promise<T>,
  takeoverMs = TAKEOVER_MS,
): Promise<T> {
  if (!existing) return start()
  let timer: ReturnType<typeof setTimeout> | undefined
  const stalled = new Promise<typeof STALLED>((resolve) => {
    timer = setTimeout(() => resolve(STALLED), takeoverMs)
  })
  try {
    const result = await Promise.race([existing, stalled])
    if (result !== STALLED) return result as T
  } finally {
    clearTimeout(timer)
  }
  return start()
}
