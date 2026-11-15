import { Cron } from "croner"
import picomatch from "picomatch"
import type { SyncJobConfig } from "./store"

export const MIN_INTERVAL_MIN = 1
export const MAX_INTERVAL_MIN = 60 * 24 * 365

export function normalizePath(p: unknown): string {
  const segs = String(p ?? "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((s) => s && s !== ".")
  if (segs.includes("..")) throw new Error("path must not contain '..'")
  return "/" + segs.join("/")
}

function isInside(child: string, parent: string): boolean {
  return parent === "/" || child === parent || child.startsWith(parent + "/")
}

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Validates and normalizes a job body; throws an Error whose message is shown to the admin. */
export function parseJobConfig(body: any): SyncJobConfig {
  const name = String(body?.name ?? "").trim()
  if (!name) throw new Error("name is required")
  if (!String(body?.src ?? "").trim()) throw new Error("source path is required")
  const src = normalizePath(body.src)
  if (src === "/") throw new Error("source must not be the root folder")
  const rawDsts: unknown[] = Array.isArray(body?.dsts) ? body.dsts : []
  const dsts = [...new Set(rawDsts.filter((d) => String(d ?? "").trim()).map(normalizePath))]
  if (dsts.length === 0) throw new Error("at least one target path is required")
  for (const d of dsts) {
    if (d === "/") throw new Error("target must not be the root folder")
    if (isInside(d, src) || isInside(src, d)) {
      throw new Error(`target ${d} overlaps the source ${src}`)
    }
  }
  const method = String(body?.method ?? "copy")
  if (method !== "copy" && method !== "mirror" && method !== "move") throw new Error("invalid method")
  const allow_delete = body?.allow_delete === true
  if (method === "move" && !allow_delete) {
    throw new Error("move removes source files, so deletion must be allowed explicitly")
  }
  const exclude = String(body?.exclude ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
  const schedule_kind = body?.schedule_kind === "cron" ? "cron" : "interval"
  const interval_min = Math.floor(Number(body?.interval_min) || 0)
  const cron = String(body?.cron ?? "").trim()
  const timezone = String(body?.timezone ?? "UTC").trim() || "UTC"
  if (!validTimezone(timezone)) throw new Error(`unknown timezone ${timezone}`)
  const config: SyncJobConfig = {
    name,
    src,
    dsts,
    method,
    allow_delete,
    exclude,
    schedule_kind,
    interval_min,
    cron,
    timezone,
  }
  if (schedule_kind === "interval") {
    if (interval_min < MIN_INTERVAL_MIN || interval_min > MAX_INTERVAL_MIN) {
      throw new Error(`interval must be between ${MIN_INTERVAL_MIN} and ${MAX_INTERVAL_MIN} minutes`)
    }
  } else {
    if (cron.split(/\s+/).length !== 5) throw new Error("cron must have five fields: minute hour day month weekday")
    try {
      new Cron(cron, { timezone, paused: true })
    } catch (e: any) {
      throw new Error(`invalid cron: ${e?.message || e}`)
    }
  }
  return config
}

/** Next scheduled start after `from` (ms), or null when the schedule has no future occurrence. */
export function nextRunAfter(config: Pick<SyncJobConfig, "schedule_kind" | "interval_min" | "cron" | "timezone">, from: number): number | null {
  if (config.schedule_kind === "interval") return from + Math.max(MIN_INTERVAL_MIN, config.interval_min) * 60_000
  const next = new Cron(config.cron, { timezone: config.timezone, paused: true }).nextRun(new Date(from))
  return next ? next.getTime() : null
}

export function previewRuns(config: SyncJobConfig, from: number, n = 3): number[] {
  const out: number[] = []
  let t = from
  for (let i = 0; i < n; i++) {
    const next = nextRunAfter(config, t)
    if (next == null) break
    out.push(next)
    t = next
  }
  return out
}

/**
 * Exclusion rules: one glob per line; a pattern without "/" matches a name at any depth,
 * a pattern with "/" matches the path relative to the source folder.
 */
export function excludeMatcher(exclude: string): (relPath: string) => boolean {
  const patterns = exclude
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  if (patterns.length === 0) return () => false
  const byName = patterns.filter((p) => !p.replace(/\/$/, "").includes("/")).map((p) => p.replace(/\/$/, ""))
  const byPath = patterns.filter((p) => p.replace(/\/$/, "").includes("/")).map((p) => p.replace(/^\//, "").replace(/\/$/, ""))
  const nameMatch = byName.length ? picomatch(byName, { dot: true }) : null
  const pathMatch = byPath.length ? picomatch(byPath, { dot: true }) : null
  return (relPath: string) => {
    const rel = relPath.replace(/^\//, "")
    const name = rel.slice(rel.lastIndexOf("/") + 1)
    return Boolean((nameMatch && nameMatch(name)) || (pathMatch && pathMatch(rel)))
  }
}
