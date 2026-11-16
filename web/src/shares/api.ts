import { request } from "@/api"

export interface Share {
  id: string
  creator: string
  accessed: number
  expires: string | null
  pwd: string
  max_accessed: number
  disabled: boolean
  files: string[]
}

export interface ShareSettings {
  pwd: string
  expires: string | null
  max_accessed: number
}

export const shareApi = {
  list: async (signal?: AbortSignal) => (await request<{ content: Share[] | null }>("GET", "/api/share/list", undefined, signal)).content ?? [],
  create: (body: ShareSettings & { files: string[]; id?: string }) => request<Share>("POST", "/api/share/create", body),
  update: (id: string, body: ShareSettings & { new_id?: string }) => request<null>("POST", "/api/share/update", { id, ...body }),
  remove: (id: string) => request<null>("POST", `/api/share/delete?id=${encodeURIComponent(id)}`),
  setDisabled: (id: string, disabled: boolean) =>
    request<null>("POST", `/api/share/${disabled ? "disable" : "enable"}?id=${encodeURIComponent(id)}`),
}

export const shareLink = (id: string) => `${location.origin}/@s/${encodeURIComponent(id)}`

export function shareState(share: Share): "active" | "disabled" | "expired" | "exhausted" {
  if (share.disabled) return "disabled"
  if (share.expires && Date.parse(share.expires) < Date.now()) return "expired"
  if (share.max_accessed > 0 && share.accessed >= share.max_accessed) return "exhausted"
  return "active"
}
