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

export function encodePath(path: string): string {
  return "/" + splitPath(path).map(encodeURIComponent).join("/")
}

export function isReservedPath(path: string): boolean {
  if (path.startsWith("/@")) return true
  return RESERVED_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))
}

export function absoluteUrl(url: string): string {
  return new URL(url, location.origin).href
}
