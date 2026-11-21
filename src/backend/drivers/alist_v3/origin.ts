export interface OriginLane { url: string; bytesPerSecond: number; key?: boolean }
interface OriginGroup { base: string; lanes: OriginLane[] }
interface Measured { lane: OriginLane; latency: number; healthy: boolean }

function groups(env: any): OriginGroup[] {
  try {
    const value = JSON.parse(env?.ALIST_ORIGIN_ROUTES || "[]")
    if (!Array.isArray(value)) return []
    return value.flatMap((group: any) => {
      const base = new URL(group.base)
      if (!/^https?:$/.test(base.protocol) || base.username || base.password || base.search || base.hash) return []
      if (!Array.isArray(group.lanes)) return []
      const lanes = group.lanes.flatMap((lane: any) => {
        try {
          const url = new URL(lane.url)
          if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return []
          if (!Number.isFinite(lane.bytesPerSecond) || lane.bytesPerSecond <= 0) return []
          if (lane.key && !env?.ALIST_ORIGIN_KEY) return []
          return [{ url: url.origin, bytesPerSecond: lane.bytesPerSecond, key: lane.key === true }]
        } catch { return [] }
      })
      return lanes.length ? [{ base: base.origin, lanes }] : []
    })
  } catch { return [] }
}

function healthKey(lane: OriginLane): Request {
  return new Request(`https://origin-health.invalid/${encodeURIComponent(lane.url)}?key=${lane.key ? 1 : 0}`)
}

async function cooldown(lane: OriginLane): Promise<void> {
  try {
    await (globalThis as any).caches?.default?.put(healthKey(lane), new Response(JSON.stringify({ healthy: false, latency: 0 }), { headers: { "Cache-Control": "public, max-age=10" } }))
  } catch {}
}

export function hasOriginRoute(url: string, env: any): boolean {
  try { return groups(env).some((item) => item.base === new URL(url).origin) } catch { return false }
}

async function probe(lane: OriginLane, secret: string): Promise<Measured> {
  const cache = (globalThis as any).caches?.default
  const cacheKey = healthKey(lane)
  try {
    const cached = await cache?.match(cacheKey)
    if (cached) return { lane, ...(await cached.json()) }
  } catch {}
  const started = Date.now()
  let healthy = false
  try {
    const headers: Record<string, string> = { "Cache-Control": "no-cache" }
    if (lane.key) headers["X-OpenList-Origin-Key"] = secret
    const response = await fetch(`${lane.url}/api/public/settings`, {
      headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(2500),
    })
    if (response.ok) {
      const data = await response.json() as any
      healthy = data?.code === 200 && data.data != null
    } else await response.body?.cancel()
  } catch {}
  const result = { healthy, latency: Math.max(1, Date.now() - started) }
  try {
    await cache?.put(cacheKey, new Response(JSON.stringify(result), {
      headers: { "Cache-Control": `public, max-age=${healthy ? 30 : 10}` },
    }))
  } catch {}
  return { lane, ...result }
}

export async function routedOriginFetch(
  url: string, init: RequestInit, env: any, size = 0, retry = false, prepare?: () => void,
): Promise<Response> {
  const target = new URL(url)
  const group = groups(env).find((item) => item.base === target.origin)
  if (!group) {
    prepare?.()
    return fetch(url, init)
  }
  const secret = typeof env?.ALIST_ORIGIN_KEY === "string" ? env.ALIST_ORIGIN_KEY : ""
  const measured = await Promise.all(group.lanes.map((lane) => probe(lane, secret)))
  const candidates = measured.filter((item) => item.healthy).sort((a, b) =>
    a.latency + Math.max(0, size) * 1000 / a.lane.bytesPerSecond -
    b.latency - Math.max(0, size) * 1000 / b.lane.bytesPerSecond,
  )
  if (!candidates.length) throw new Error("No reachable configured origin")
  let lastError: unknown
  for (const { lane } of candidates) {
    const headers = new Headers(init.headers)
    headers.delete("X-OpenList-Origin-Key")
    if (lane.key) headers.set("X-OpenList-Origin-Key", secret)
    const destination = new URL(target.pathname + target.search, lane.url)
    try {
      prepare?.()
      const response = await fetch(destination, { ...init, headers, redirect: "manual" })
      if ([502, 503, 504].includes(response.status)) {
        await cooldown(lane)
        if (!retry) return response
        await response.body?.cancel()
        lastError = new Error(`Origin returned ${response.status}`)
        continue
      }
      return response
    } catch (error) {
      lastError = error
      await cooldown(lane)
      if (!retry) throw error
    }
  }
  throw lastError || new Error("No reachable configured origin")
}
