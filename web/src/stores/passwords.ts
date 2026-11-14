import { normalizePath } from "@/utils/path"

const STORAGE_KEY = "folder.passwords"

function read(): Record<string, string> {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}")
  } catch {
    return {}
  }
}

function write(map: Record<string, string>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* storage unavailable */
  }
}

/** Password saved for the path or its nearest protected ancestor. */
export function passwordFor(path: string): string {
  const map = read()
  let current = normalizePath(path)
  for (;;) {
    if (map[current]) return map[current]
    if (current === "/") return ""
    current = current.slice(0, current.lastIndexOf("/")) || "/"
  }
}

export function rememberPassword(path: string, password: string): void {
  write({ ...read(), [normalizePath(path)]: password })
}

/** Drop the password that currently covers the path (the entry it was saved under). */
export function forgetPassword(path: string): void {
  const map = read()
  let current = normalizePath(path)
  for (;;) {
    if (current in map) {
      delete map[current]
      write(map)
      return
    }
    if (current === "/") return
    current = current.slice(0, current.lastIndexOf("/")) || "/"
  }
}
