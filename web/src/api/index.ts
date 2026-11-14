import { request } from "./http"
import type { FsDir, FsFile, FsList, SiteSettings, UserInfo } from "./types"

export { apiError, ApiError, clearToken, getToken, setToken } from "./http"
export type { ApiErrorKind } from "./http"
export * from "./types"

export interface FsOptions {
  signal?: AbortSignal
  refresh?: boolean
}

export const api = {
  settings: () => request<SiteSettings>("GET", "/api/public/settings"),
  me: () => request<UserInfo>("GET", "/api/me"),
  logout: () => request<null>("GET", "/api/auth/logout"),
  // per_page 0 returns the whole folder so sorting stays correct across the listing
  fsList: (path: string, password: string, opts: FsOptions = {}) =>
    request<FsList>(
      "POST",
      "/api/fs/list",
      { path, password, page: 1, per_page: 0, refresh: !!opts.refresh },
      opts.signal,
    ),
  fsGet: (path: string, password: string, opts: FsOptions = {}) =>
    request<FsFile>("POST", "/api/fs/get", { path, password }, opts.signal),
  fsDirs: (path: string, password: string, signal?: AbortSignal) =>
    request<FsDir[] | null>("POST", "/api/fs/dirs", { path, password }, signal),
  fsMkdir: (path: string) => request<null>("POST", "/api/fs/mkdir", { path }),
  fsRename: (path: string, name: string) => request<null>("POST", "/api/fs/rename", { path, name }),
  fsRemove: (dir: string, names: string[]) => request<null>("POST", "/api/fs/remove", { dir, names }),
  fsMove: (srcDir: string, dstDir: string, names: string[]) =>
    request<null>("POST", "/api/fs/move", { src_dir: srcDir, dst_dir: dstDir, names }),
  fsCopy: (srcDir: string, dstDir: string, names: string[]) =>
    request<null>("POST", "/api/fs/copy", { src_dir: srcDir, dst_dir: dstDir, names }),
}
