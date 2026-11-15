export type SyncMethod = "copy" | "mirror" | "move"
export type ScheduleKind = "interval" | "cron"
export type RunState = "running" | "success" | "partial" | "failed" | "stopped"
export type ItemStatus = "pending" | "running" | "done" | "failed" | "skipped"

export interface RunCounts {
  pending: number
  running: number
  done: number
  failed: number
  skipped: number
  copied: number
  deleted: number
  bytes: number
}

export interface SyncJobForm {
  name: string
  src: string
  dsts: string[]
  method: SyncMethod
  allow_delete: boolean
  exclude: string
  schedule_kind: ScheduleKind
  interval_min: number
  cron: string
  timezone: string
}

export interface SyncJob extends SyncJobForm {
  id: number
  enabled: boolean
  next_run_at: number | null
  last_run: { id: number; state: RunState; started_at: number; finished_at: number | null; counts: RunCounts | null } | null
}

export interface SyncRun {
  id: number
  job_id: number
  trigger: "schedule" | "manual"
  dry_run: boolean
  phase: "scan" | "transfer" | "done"
  state: RunState
  stop_requested: boolean
  error: string
  delete_blocked: string
  scanned_files: number
  scanned_dirs: number
  started_at: number
  finished_at: number | null
  counts: RunCounts
}

export interface SyncItem {
  id: number
  action: "scan" | "mkdir" | "copy" | "delete" | "remove_src"
  rel_path: string
  target: number
  size: number
  status: ItemStatus
  mode: string
  error: string
}

export const emptyJob = (): SyncJobForm => ({
  name: "",
  src: "",
  dsts: [""],
  method: "copy",
  allow_delete: false,
  exclude: "",
  schedule_kind: "interval",
  interval_min: 60,
  cron: "0 3 * * *",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
})

/** Formats epoch milliseconds with the shared date formatter. */
export const isoOf = (ms: number | null | undefined) => (ms ? new Date(ms).toISOString() : undefined)
