import { basePath } from "@/stores/session"
import { passwordFor } from "@/stores/passwords"
import { absoluteUrl, encodePath, isSharePath, joinPath, shareRoot, splitPath } from "./path"

/**
 * Direct download URL for an entry listed in a folder. The backend verifies the
 * signature against the real storage path, so the user's base path is prepended.
 */
export function entryDownloadUrl(path: string, sign: string): string {
  if (isSharePath(path)) {
    const pwd = passwordFor(shareRoot(path)!)
    const url = "/sd" + encodePath("/" + splitPath(path).slice(1).join("/"))
    return pwd ? `${url}?pwd=${encodeURIComponent(pwd)}` : url
  }
  const url = "/d" + encodePath(joinPath(basePath.value, path))
  return sign ? `${url}?sign=${encodeURIComponent(sign)}` : url
}

export function pageUrl(path: string): string {
  return absoluteUrl(encodePath(path))
}
