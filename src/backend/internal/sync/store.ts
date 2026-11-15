// Durable state of sync jobs lives in its own D1 tables, outside the whole-config blob that getDb/saveDb rewrite.

export type SyncMethod = "copy" | "mirror" | "move"
export type ScheduleKind = "interval" | "cron"
export type RunState = "running" | "success" | "partial" | "failed" | "stopped"
export type ItemAction = "scan" | "mkdir" | "copy" | "delete" | "move" | "remove_src"
export type ItemStatus = "pending" | "running" | "done" | "failed" | "skipped"

export interface SyncJobConfig {
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

export interface SyncJob extends SyncJobConfig {
  id: number
  enabled: boolean
  next_run_at: number | null
  created_at: number
  updated_at: number
}

export interface SyncRun {
  id: number
  job_id: number
  trigger: "schedule" | "manual"
  dry_run: boolean
  phase: "scan" | "transfer" | "done"
  state: RunState
  stop_requested: boolean
  config: SyncJobConfig
  error: string
  scanned_files: number
  scanned_dirs: number
  started_at: number
  finished_at: number | null
  delete_blocked: string
  summary: RunCounts | null
  lease_until: number | null
}

export interface SyncItem {
  id: number
  run_id: number
  action: ItemAction
  rel_path: string
  target: number
  size: number
  modified: string
  status: ItemStatus
  mode: string
  error: string
  detail: string
  updated_at: number
}

export interface D1Like {
  prepare(sql: string): any
  batch(statements: any[]): Promise<any[]>
}

export function getSyncDb(env: any): D1Like | null {
  for (const name of ["DB", "OPENLIST_DB"]) {
    const b = env?.[name]
    if (b && typeof b === "object" && typeof b.prepare === "function") return b
  }
  return null
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sync_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    src TEXT NOT NULL,
    dsts TEXT NOT NULL,
    method TEXT NOT NULL,
    allow_delete INTEGER NOT NULL DEFAULT 0,
    exclude TEXT NOT NULL DEFAULT '',
    schedule_kind TEXT NOT NULL,
    interval_min INTEGER NOT NULL DEFAULT 0,
    cron TEXT NOT NULL DEFAULT '',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    enabled INTEGER NOT NULL DEFAULT 1,
    next_run_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL,
    trigger TEXT NOT NULL,
    dry_run INTEGER NOT NULL DEFAULT 0,
    phase TEXT NOT NULL,
    state TEXT NOT NULL,
    stop_requested INTEGER NOT NULL DEFAULT 0,
    config TEXT NOT NULL,
    error TEXT NOT NULL DEFAULT '',
    scanned_files INTEGER NOT NULL DEFAULT 0,
    scanned_dirs INTEGER NOT NULL DEFAULT 0,
    started_at INTEGER NOT NULL,
    finished_at INTEGER,
    delete_blocked TEXT NOT NULL DEFAULT '',
    summary TEXT NOT NULL DEFAULT '',
    lease_until INTEGER,
    lease_owner TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sync_runs_job ON sync_runs (job_id, id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS sync_runs_active ON sync_runs (job_id) WHERE state = 'running'`,
  `CREATE INDEX IF NOT EXISTS sync_runs_state ON sync_runs (state)`,
  `CREATE TABLE IF NOT EXISTS sync_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    rel_path TEXT NOT NULL,
    target INTEGER NOT NULL DEFAULT -1,
    size INTEGER NOT NULL DEFAULT 0,
    modified TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT '',
    error TEXT NOT NULL DEFAULT '',
    detail TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sync_items_run ON sync_items (run_id, status, id)`,
]

const inited = new WeakMap<object, Promise<void>>()

export function ensureSyncSchema(db: D1Like): Promise<void> {
  let p = inited.get(db)
  if (!p) {
    p = db.batch(SCHEMA.map((s) => db.prepare(s))).then(() => undefined)
    p.catch(() => inited.delete(db))
    inited.set(db, p)
  }
  return p
}

const bool = (v: unknown) => v === 1 || v === true || v === "1"

export function rowToJob(r: any): SyncJob {
  return {
    id: r.id,
    name: r.name,
    src: r.src,
    dsts: JSON.parse(r.dsts || "[]"),
    method: r.method,
    allow_delete: bool(r.allow_delete),
    exclude: r.exclude || "",
    schedule_kind: r.schedule_kind,
    interval_min: Number(r.interval_min) || 0,
    cron: r.cron || "",
    timezone: r.timezone || "UTC",
    enabled: bool(r.enabled),
    next_run_at: r.next_run_at ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }
}

export function rowToRun(r: any): SyncRun {
  return {
    id: r.id,
    job_id: r.job_id,
    trigger: r.trigger,
    dry_run: bool(r.dry_run),
    phase: r.phase,
    state: r.state,
    stop_requested: bool(r.stop_requested),
    config: JSON.parse(r.config || "{}"),
    error: r.error || "",
    scanned_files: Number(r.scanned_files) || 0,
    scanned_dirs: Number(r.scanned_dirs) || 0,
    started_at: r.started_at,
    finished_at: r.finished_at ?? null,
    delete_blocked: r.delete_blocked || "",
    summary: r.summary ? JSON.parse(r.summary) : null,
    lease_until: r.lease_until ?? null,
  }
}

export async function getJob(db: D1Like, id: number): Promise<SyncJob | null> {
  const r = await db.prepare("SELECT * FROM sync_jobs WHERE id = ?").bind(id).first()
  return r ? rowToJob(r) : null
}

export async function getRun(db: D1Like, id: number): Promise<SyncRun | null> {
  const r = await db.prepare("SELECT * FROM sync_runs WHERE id = ?").bind(id).first()
  return r ? rowToRun(r) : null
}

export async function getActiveRun(db: D1Like, jobId: number): Promise<SyncRun | null> {
  const r = await db
    .prepare("SELECT * FROM sync_runs WHERE job_id = ? AND state = 'running' ORDER BY id DESC LIMIT 1")
    .bind(jobId)
    .first()
  return r ? rowToRun(r) : null
}

export interface NewItem {
  action: ItemAction
  rel_path: string
  target?: number
  size?: number
  modified?: string
  status?: ItemStatus
  mode?: string
  error?: string
  detail?: string
}

const ITEM_COLS = 10
// D1 binds at most 100 parameters per statement
const ROWS_PER_INSERT = Math.floor(100 / ITEM_COLS)

export function insertItemStatements(db: D1Like, runId: number, items: NewItem[], now: number): any[] {
  const stmts: any[] = []
  for (let i = 0; i < items.length; i += ROWS_PER_INSERT) {
    const chunk = items.slice(i, i + ROWS_PER_INSERT)
    const values: any[] = []
    for (const it of chunk) {
      values.push(
        runId,
        it.action,
        it.rel_path,
        it.target ?? -1,
        it.size ?? 0,
        it.modified ?? "",
        it.status ?? "pending",
        it.mode ?? "",
        it.error ?? "",
        it.detail ?? "",
      )
    }
    const placeholders = chunk.map(() => `(?,?,?,?,?,?,?,?,?,?,${now})`).join(",")
    stmts.push(
      db
        .prepare(
          `INSERT INTO sync_items (run_id, action, rel_path, target, size, modified, status, mode, error, detail, updated_at) VALUES ${placeholders}`,
        )
        .bind(...values),
    )
  }
  return stmts
}

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

export async function countItems(db: D1Like, runId: number): Promise<RunCounts> {
  const { results } = await db
    .prepare(
      `SELECT action, status, COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM sync_items
       WHERE run_id = ? AND action != 'scan' GROUP BY action, status`,
    )
    .bind(runId)
    .all()
  const counts: RunCounts = { pending: 0, running: 0, done: 0, failed: 0, skipped: 0, copied: 0, deleted: 0, bytes: 0 }
  for (const r of results || []) {
    const n = Number(r.n) || 0
    if (r.status in counts) (counts as any)[r.status] += n
    if (r.status === "done" && (r.action === "copy" || r.action === "move")) {
      counts.copied += n
      counts.bytes += Number(r.bytes) || 0
    }
    if (r.status === "done" && (r.action === "delete" || r.action === "remove_src")) counts.deleted += n
  }
  // Failed directory scans count as failures too, since they block deletion
  const scanFailed = await db
    .prepare("SELECT COUNT(*) AS n FROM sync_items WHERE run_id = ? AND action = 'scan' AND status = 'failed'")
    .bind(runId)
    .first()
  counts.failed += Number(scanFailed?.n) || 0
  return counts
}
