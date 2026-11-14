import type { ApiEnvelope } from "./types"

const TOKEN_KEY = "token"

export type ApiErrorKind = "unauthorized" | "forbidden" | "not-found" | "network" | "server"

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    message: string,
    readonly code: number,
  ) {
    super(message)
  }
}

export function getToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || ""
  } catch {
    return ""
  }
}

export function setToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* storage unavailable */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* storage unavailable */
  }
}

// The backend reports a missing object as code 500 with a "not found" message
const NOT_FOUND = /not found|no such|does not exist/i

function classify(code: number, message: string): ApiErrorKind {
  if (code === 401) return "unauthorized"
  if (code === 403) return "forbidden"
  if (code === 404 || NOT_FOUND.test(message)) return "not-found"
  return "server"
}

export async function request<T>(
  method: "GET" | "POST",
  url: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) headers.Authorization = token
  if (body !== undefined) headers["Content-Type"] = "application/json"

  let res: Response
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new ApiError("network", "无法连接到服务器", 0)
  }

  let envelope: ApiEnvelope<T> | null = null
  try {
    envelope = (await res.json()) as ApiEnvelope<T>
  } catch {
    /* non-JSON response */
  }
  const code = envelope?.code ?? res.status
  if (!envelope || code !== 200) {
    const message = envelope?.message || res.statusText || "请求失败"
    throw new ApiError(classify(code, message), message, code)
  }
  return envelope.data
}
