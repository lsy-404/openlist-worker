import { session } from "@/stores/session"

export function settingText(key: string): string {
  const value = session.settings?.[key]
  return typeof value === "string" ? value : ""
}

export function settingFlag(key: string): boolean {
  return settingText(key) === "true"
}

/** Comma separated setting as a lower-case set. */
export function settingList(key: string): Set<string> {
  return new Set(
    settingText(key)
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function settingJson<T>(key: string): T | null {
  const text = settingText(key)
  if (!text) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
