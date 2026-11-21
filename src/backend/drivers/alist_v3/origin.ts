export interface OriginLane { url: string; bytesPerSecond: number; key?: boolean }
interface OriginGroup { base?: string; mountPath?: string; rawOrigins: string[]; lanes: OriginLane[] }
interface Measured { lane: OriginLane; latency: number; healthy: boolean }
export interface OriginContext { baseUrl: string; mountPath?: string; kind: "api" | "raw" }

export class OriginUnavailableError extends Error {}

function groups(env: any): OriginGroup[] {
  try {
    const value = JSON.parse(env?.ALIST_ORIGIN_ROUTES || "[]")
    if (!Array.isArray(value)) return []
    return value.flatMap((group: any) => {
      try {
        const baseUrl = group.base ? new URL(group.base) : undefined
        if (baseUrl && (!/^https?:$/.test(baseUrl.protocol) || baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash)) return []
        const mountPath = typeof group.mountPath === "string" && group.mountPath.startsWith("/") ? group.mountPath : undefined
        if (!baseUrl && !mountPath) return []
        if (!Array.isArray(group.lanes)) return []
        const rawOrigins = Array.isArray(group.rawOrigins) ? group.rawOrigins.map((value: string) => {
          const url = new URL(value)
          if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) throw new Error("Invalid raw origin")
          return url.origin
        }) : []
        const lanes = group.lanes.flatMap((lane: any) => {
          try {
            const url = new URL(lane.url)
            if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.pathname !== "/") return []
            if (!Number.isFinite(lane.bytesPerSecond) || lane.bytesPerSecond <= 0) return []
            if (lane.key && !env?.ALIST_ORIGIN_KEY) return []
            return [{ url: url.origin, bytesPerSecond: lane.bytesPerSecond, key: lane.key === true }]
          } catch { return [] }
        })
        return lanes.length ? [{ base: baseUrl?.origin, mountPath, rawOrigins, lanes }] : []
      } catch { return [] }
    })
  } catch { return [] }
}

function findGroup(env: any, context: OriginContext): OriginGroup | undefined {
  let base: string
  try { base = new URL(context.baseUrl).origin } catch { return undefined }
  const all = groups(env)
  return all.find((group) => group.mountPath && group.mountPath === context.mountPath) ||
    all.find((group) => !group.mountPath && group.base === base)
}

function healthKey(lane: OriginLane): Request {
  const key = new URL(lane.url)
  key.pathname = `/__openlist_origin_health__/${lane.key ? 1 : 0}`
  return new Request(key)
}

async function cooldown(lane: OriginLane): Promise<void> {
  try {
    await (globalThis as any).caches?.default?.put(healthKey(lane), new Response(JSON.stringify({ healthy: false, latency: 0 }), { headers: { "Cache-Control": "public, max-age=10" } }))
  } catch {}
}

export function hasOriginRoute(url: string, env: any, context?: OriginContext): boolean {
  try {
    const effective = context || { baseUrl: url, kind: "api" as const }
    const group = findGroup(env, effective)
    if (!group) return false
    const target = new URL(url)
    const base = new URL(effective.baseUrl)
    if (effective.kind === "api") return target.origin === base.origin
    return /^\/(d|p)(\/|$)/.test(target.pathname) &&
      (target.origin === base.origin || group.rawOrigins.includes(target.origin))
  } catch { return false }
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
  url: string, init: RequestInit, env: any, size = 0, retry = false, prepare?: () => void, context?: OriginContext,
): Promise<Response> {
  const target = new URL(url)
  const effective = context || { baseUrl: url, kind: "api" as const }
  const group = hasOriginRoute(url, env, effective) ? findGroup(env, effective) : undefined
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
  if (!candidates.length) throw new OriginUnavailableError("No reachable configured origin")
  let lastError: unknown
  for (const { lane } of candidates) {
    const headers = new Headers(init.headers)
    headers.delete("X-OpenList-Origin-Key")
    if (lane.key) headers.set("X-OpenList-Origin-Key", secret)
    const destination = new URL(lane.url)
    const prefix = effective.kind === "api" ? new URL(effective.baseUrl).pathname.replace(/\/+$/, "") : ""
    destination.pathname = prefix && target.pathname.startsWith(prefix + "/") ? target.pathname.slice(prefix.length) : target.pathname
    destination.search = target.search
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
  throw new OriginUnavailableError(lastError instanceof Error ? lastError.message : "No reachable configured origin")
}
