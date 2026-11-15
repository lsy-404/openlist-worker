export interface Storage {
  id: number
  mount_path: string
  driver: string
  order: number
  remark: string
  status: string
  disabled: boolean
  addition: string
  [key: string]: unknown
}

export interface DriverField {
  name: string
  type: "string" | "text" | "number" | "float" | "bool" | "select"
  default?: string
  required?: boolean
  help?: string
  options?: string
}

export interface DriverInfo {
  name: string
  default_mount_path: string
  common: DriverField[]
  additional: DriverField[]
}

export type FieldValue = string | number | boolean
export type Values = Record<string, FieldValue>

export const GENERAL_FIELDS = ["mount_path", "order", "remark"]
const SECRET = /secret|token|password|passwd|cookie|_key$|^key$|sharekey/i

export const isSecret = (field: DriverField) => SECRET.test(field.name)

/** refresh_token -> "Refresh token" */
export function humanize(name: string): string {
  const words = name.replace(/[_-]+/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The schema uses the literal "true" as a placeholder help text. */
export function helpText(field: DriverField): string | undefined {
  const help = field.help?.trim()
  return help && help !== "true" ? help : undefined
}

export function coerce(field: DriverField, raw: unknown): FieldValue {
  if (field.type === "bool") return raw === true || raw === "true"
  if (field.type === "number" || field.type === "float") {
    const n = Number(raw)
    return raw === "" || raw == null || Number.isNaN(n) ? 0 : n
  }
  return raw == null ? "" : String(raw)
}

export function parseAddition(addition: unknown): Record<string, unknown> {
  if (addition && typeof addition === "object") return addition as Record<string, unknown>
  try {
    const parsed: unknown = JSON.parse(String(addition || "{}"))
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function defaults(fields: DriverField[]): Values {
  return Object.fromEntries(fields.map((f) => [f.name, coerce(f, f.default)]))
}

export function fromSource(fields: DriverField[], source: Record<string, unknown>): Values {
  return Object.fromEntries(
    fields.map((f) => [f.name, coerce(f, source[f.name] !== undefined ? source[f.name] : f.default)]),
  )
}

export function isEmpty(field: DriverField, value: FieldValue | undefined): boolean {
  if (field.type === "bool" || field.type === "number" || field.type === "float") return false
  return value === undefined || String(value).trim() === ""
}

export type StatusKind = "working" | "disabled" | "error"

export function statusOf(storage: Storage): StatusKind {
  if (storage.disabled) return "disabled"
  return storage.status === "work" ? "working" : "error"
}
