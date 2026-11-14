import { basePath } from "@/stores/session"
import { absoluteUrl, encodePath, joinPath } from "./path"

/**
 * Direct download URL for an entry listed in a folder. The backend verifies the
 * signature against the real storage path, so the user's base path is prepended.
 */
export function entryDownloadUrl(path: string, sign: string): string {
  const url = "/d" + encodePath(joinPath(basePath.value, path))
  return sign ? `${url}?sign=${encodeURIComponent(sign)}` : url
}

export function pageUrl(path: string): string {
  return absoluteUrl(encodePath(path))
}
