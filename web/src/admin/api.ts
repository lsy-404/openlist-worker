import { request } from "@/api"

type Query = Record<string, string | number | boolean | undefined>

export interface Paged<T> {
  content: T[]
  total: number
}

function url(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined) params.set(key, String(value))
  const qs = params.toString()
  return `/api/admin${path}${qs ? `?${qs}` : ""}`
}

/** GET /api/admin<path>; resolves with the envelope's data and throws ApiError otherwise. */
export function adminGet<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
  return request<T>("GET", url(path, query), undefined, signal)
}

/** POST /api/admin<path> with a JSON body and optional query string (some endpoints take `id` in the query). */
export function adminPost<T = null>(path: string, body?: unknown, query?: Query): Promise<T> {
  return request<T>("POST", url(path, query), body ?? {})
}

/** GET <path> for endpoints answering { content, total }; a null content becomes an empty list. */
export async function adminList<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T[]> {
  const page = await adminGet<Paged<T> | null>(path, query, signal)
  return page?.content ?? []
}
