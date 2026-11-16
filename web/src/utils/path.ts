export const RESERVED_PREFIXES = ["/@", "/api", "/d", "/p", "/dav", "/s3", "/assets"]

export function normalizePath(path: string): string {
  return "/" + path.split("/").filter(Boolean).join("/")
}

export function splitPath(path: string): string[] {
  return path.split("/").filter(Boolean)
}

export function joinPath(...parts: string[]): string {
  return normalizePath(parts.join("/"))
}

export function parentPath(path: string): string {
  const parts = splitPath(path)
  parts.pop()
  return "/" + parts.join("/")
}

// "@" is legal in a path and keeps /@s share links readable
export function encodePath(path: string): string {
  return "/" + splitPath(path).map((s) => encodeURIComponent(s).replace(/%40/g, "@")).join("/")
}

/** Share pages live at /@s/<id>/...; the backend maps them onto the shared files. */
export function isSharePath(path: string): boolean {
  return path === "/@s" || path.startsWith("/@s/")
}

/** `/@s/<id>` for any path inside that share, null elsewhere. */
export function shareRoot(path: string): string | null {
  return isSharePath(path) ? "/" + splitPath(path).slice(0, 2).join("/") : null
}

export function isReservedPath(path: string): boolean {
  if (isSharePath(path)) return false
  if (path.startsWith("/@")) return true
  return RESERVED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))
}

export function absoluteUrl(url: string): string {
  return new URL(url, location.origin).href
}
