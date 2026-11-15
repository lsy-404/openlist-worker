import { i18n } from "@/i18n"

const UNITS = ["B", "KB", "MB", "GB", "TB", "PB"]

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return `${unit === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${UNITS[unit]}`
}

const dateFormats = new Map<string, Intl.DateTimeFormat>()

function dateFormat(): Intl.DateTimeFormat {
  const locale = i18n.global.locale.value
  let format = dateFormats.get(locale)
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    dateFormats.set(locale, format)
  }
  return format
}

export function formatDate(value: string | undefined): string {
  if (!value) return "—"
  const time = Date.parse(value)
  return Number.isNaN(time) ? "—" : dateFormat().format(time)
}

export function extension(name: string): string {
  const dot = name.lastIndexOf(".")
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ""
}
