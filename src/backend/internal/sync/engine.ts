import type { FileItem } from "../driver/base"
import { excludeMatcher, nextRunAfter } from "./config"
import {
  countItems,
  ensureSyncSchema,
  getRun,
  getSyncDb,
  insertItemStatements,
  rowToJob,
  rowToRun,
  type D1Like,
  type NewItem,
  type SyncItem,
  type SyncJob,
  type SyncRun,
} from "./store"
import {
  listMount,
  mkdirMount,
  NotFoundError,
  relayFile,
  removeMount,
  sameNode,
  serverCopy,
  statMount,
} from "./transfer"

/** Wall-clock limit of a Cron Trigger invocation is 15 minutes; stay clear of it. */
export const CRON_BUDGET = { softMs: 9 * 60_000, hardMs: 13 * 60_000 }
/** HTTP-triggered work runs inside waitUntil (30 s after the response) or the request itself, so it only scans. */
export const REQUEST_BUDGET = { softMs: 15_000, hardMs: 20_000 }
const LEASE_EXTRA_MS = 2 * 60_000
const GROUP_SIZE = 3
// Stay well below the 1000 D1 queries allowed per invocation
const MAX_QUERIES_PER_TICK = 850
const KEEP_RUNS_PER_JOB = 20

const INTERRUPTED = "interrupted: the invocation ended before this item finished (it did not complete within one invocation's time limit)"

interface Budget {
  softMs: number
  hardMs: number
}

class Tick {
  readonly started = Date.now()
  readonly owner = crypto.randomUUID()
  queries = 0
  readonly abort = new AbortController()
  private timer: any
  constructor(
    readonly db: D1Like,
    readonly env: any,
    readonly budget: Budget,
    readonly transfers: boolean,
  ) {
    this.timer = setTimeout(() => this.abort.abort(new Error("time limit")), budget.hardMs)
  }
  get soft(): boolean {
    return Date.now() - this.started >= this.budget.softMs || this.queries >= MAX_QUERIES_PER_TICK
  }
  q<T>(p: T): T {
    this.queries++
    return p
  }
  close() {
    clearTimeout(this.timer)
  }
}

const join = (base: string, rel: string) => (rel ? `${base.replace(/\/$/, "")}${rel}` : base)

/** Creates a run for the job with a pending root scan; returns null when the job already has an active run. */
export async function startRun(db: D1Like, job: SyncJob, trigger: "schedule" | "manual", dryRun: boolean): Promise<SyncRun | null> {
  const now = Date.now()
  const config = {
    name: job.name,
    src: job.src,
    dsts: job.dsts,
    method: job.method,
    allow_delete: job.allow_delete,
    exclude: job.exclude,
    schedule_kind: job.schedule_kind,
    interval_min: job.interval_min,
    cron: job.cron,
    timezone: job.timezone,
  }
  let row: any
  try {
    row = await db
      .prepare(
        "INSERT INTO sync_runs (job_id, trigger, dry_run, phase, state, config, started_at) VALUES (?, ?, ?, 'scan', 'running', ?, ?) RETURNING *",
      )
      .bind(job.id, trigger, dryRun ? 1 : 0, JSON.stringify(config), now)
      .first()
  } catch (e: any) {
    if (/UNIQUE/i.test(String(e?.message || e))) return null
    throw e
  }
  await db.batch([
    ...insertItemStatements(db, row.id, [{ action: "scan", rel_path: "", detail: "[]" }], now),
    db.prepare("UPDATE sync_jobs SET next_run_at = NULL WHERE id = ? AND ? = 'schedule'").bind(job.id, trigger),
  ])
  return rowToRun(row)
}

async function acquireLease(t: Tick, runId: number): Promise<boolean> {
  const now = Date.now()
  const res = await t.q(
    t.db
      .prepare(
        "UPDATE sync_runs SET lease_until = ?, lease_owner = ? WHERE id = ? AND state = 'running' AND (lease_until IS NULL OR lease_until < ?)",
      )
      .bind(now + t.budget.hardMs + Math.min(LEASE_EXTRA_MS, t.budget.hardMs), t.owner, runId, now)
      .run(),
  )
  return (res?.meta?.changes ?? 0) === 1
}

async function releaseLease(t: Tick, runId: number) {
  await t.q(t.db.prepare("UPDATE sync_runs SET lease_until = NULL, lease_owner = NULL WHERE id = ? AND lease_owner = ?").bind(runId, t.owner).run())
}

/** Runs one scheduler pass: starts due jobs, then advances active runs until the budget is spent. */
export async function syncTick(env: any, budget: Budget = CRON_BUDGET, transfers = true, onlyRunId?: number): Promise<void> {
  const db = getSyncDb(env)
  if (!db) return
  await ensureSyncSchema(db)
  const t = new Tick(db, env, budget, transfers)
  try {
    if (onlyRunId === undefined) {
      const { results: due } = await t.q(
        db.prepare("SELECT * FROM sync_jobs WHERE enabled = 1 AND next_run_at IS NOT NULL AND next_run_at <= ?").bind(Date.now()).all(),
      )
      for (const r of due || []) {
        try {
          await t.q(startRun(db, rowToJob(r), "schedule", false))
        } catch (e) {
          console.error("[sync] failed to start scheduled run", r.id, e)
        }
      }
    }
    const { results: active } = await t.q(
      onlyRunId === undefined
        ? db.prepare("SELECT id FROM sync_runs WHERE state = 'running' AND (lease_until IS NULL OR lease_until < ?) ORDER BY id").bind(Date.now()).all()
        : db.prepare("SELECT id FROM sync_runs WHERE id = ? AND state = 'running'").bind(onlyRunId).all(),
    )
    for (const r of active || []) {
      if (t.soft) break
      if (!(await acquireLease(t, r.id))) continue
      try {
        await advanceRun(t, r.id)
      } catch (e: any) {
        await failRun(t, r.id, `engine error: ${e?.message || e}`)
      } finally {
        await releaseLease(t, r.id)
      }
    }
  } finally {
    t.close()
  }
}

async function advanceRun(t: Tick, runId: number) {
  // Items left running belong to an invocation that died while holding the lease
  await t.q(
    t.db
      .prepare("UPDATE sync_items SET status = 'failed', error = ?, updated_at = ? WHERE run_id = ? AND status = 'running'")
      .bind(INTERRUPTED, Date.now(), runId)
      .run(),
  )
  while (!t.soft) {
    const run = await t.q(getRun(t.db, runId))
    if (!run || run.state !== "running") return
    if (run.stop_requested) return finishRun(t, run, "stopped")
    if (run.phase === "scan") {
      const more = await scanStep(t, run)
      if (more) continue
      if (run.dry_run) return finishRun(t, run)
      await t.q(t.db.prepare("UPDATE sync_runs SET phase = 'transfer' WHERE id = ?").bind(runId).run())
      await blockDeletionsIfUnsafe(t, runId)
      continue
    }
    if (run.phase === "transfer") {
      if (!t.transfers) return
      const more = await transferStep(t, run)
      if (!more) return finishRun(t, run)
    }
  }
}

async function failRun(t: Tick, runId: number, error: string) {
  const run = await getRun(t.db, runId)
  if (run && run.state === "running") await finishRun(t, run, "failed", error)
}

/** Scans one batch of pending folders; returns false once no folder is left to scan. */
async function scanStep(t: Tick, run: SyncRun): Promise<boolean> {
  const { results } = await t.q(
    t.db.prepare("SELECT * FROM sync_items WHERE run_id = ? AND action = 'scan' AND status = 'pending' ORDER BY id LIMIT 20").bind(run.id).all(),
  )
  const scans = (results || []) as SyncItem[]
  if (scans.length === 0) return false
  const excluded = excludeMatcher(run.config.exclude)
  for (const scan of scans) {
    if (t.soft) return true
    const fresh = await t.q(getRun(t.db, run.id))
    if (!fresh || fresh.stop_requested || fresh.state !== "running") return true
    const outcome = await scanFolder(t, run, scan, excluded)
    if (outcome === "fatal") return true
  }
  return true
}

type Entries = Map<string, FileItem>

async function scanFolder(t: Tick, run: SyncRun, scan: SyncItem, excluded: (rel: string) => boolean): Promise<"ok" | "fatal"> {
  const cfg = run.config
  const rel = scan.rel_path
  const isRoot = rel === ""
  const missing = new Set<number>(JSON.parse(scan.detail || "[]"))
  const now = Date.now()
  const items: NewItem[] = []
  const notes: string[] = []

  let srcList: FileItem[]
  try {
    srcList = await listMount(join(cfg.src, rel), t.env)
  } catch (e: any) {
    const msg = `source listing failed: ${e?.message || e}`
    if (isRoot) {
      await finishRun(t, run, "failed", msg)
      return "fatal"
    }
    await t.q(t.db.prepare("UPDATE sync_items SET status = 'failed', error = ?, updated_at = ? WHERE id = ?").bind(msg, now, scan.id).run())
    return "ok"
  }
  const src: Entries = new Map()
  for (const f of srcList) if (!excluded(`${rel}/${f.name}`)) src.set(f.name, f)

  const targets: Array<Entries | null> = []
  for (let ti = 0; ti < cfg.dsts.length; ti++) {
    if (missing.has(ti)) {
      targets.push(new Map())
      continue
    }
    const dstDir = join(cfg.dsts[ti], rel)
    try {
      const list = await listMount(dstDir, t.env)
      targets.push(new Map(list.map((f) => [f.name, f])))
    } catch (e: any) {
      if (isRoot && e instanceof NotFoundError) {
        missing.add(ti)
        targets.push(new Map())
        items.push({ action: "mkdir", rel_path: "", target: ti, status: run.dry_run ? "skipped" : "pending", error: run.dry_run ? "dry run" : "" })
        continue
      }
      targets.push(null)
      items.push({ action: "scan", rel_path: rel, target: ti, status: "failed", error: `target listing failed: ${e?.message || e}` })
    }
  }

  // An empty source root while a target still has content is far more likely an outage than a real wipe
  if (isRoot && src.size === 0 && targets.some((m) => m && m.size > 0)) {
    notes.push("source folder listed as empty while a target has content; deletions are disabled for this run")
  }

  const childMissing = new Map<string, number[]>()
  const childScan = new Set<string>()
  const pending = run.dry_run ? "skipped" : "pending"
  const pendingError = run.dry_run ? "dry run" : ""

  for (const [name, f] of src) {
    const path = `${rel}/${name}`
    let needsRemoveSrc = false
    for (let ti = 0; ti < targets.length; ti++) {
      const tm = targets[ti]
      if (!tm) continue
      const other = tm.get(name)
      if (f.is_dir) {
        if (other && !other.is_dir) {
          items.push({ action: "copy", rel_path: path, target: ti, status: "failed", error: "a file with this name exists on the target where the source has a folder" })
          continue
        }
        childScan.add(name)
        if (!other) {
          items.push({ action: "mkdir", rel_path: path, target: ti, status: pending, error: pendingError })
          childMissing.set(name, [...(childMissing.get(name) || []), ti])
        }
        continue
      }
      if (other && other.is_dir) {
        items.push({ action: "copy", rel_path: path, target: ti, size: f.size, status: "failed", error: "a folder with this name exists on the target where the source has a file" })
        continue
      }
      if (cfg.method === "move") needsRemoveSrc = true
      if (other && other.size === f.size) continue
      items.push({ action: "copy", rel_path: path, target: ti, size: f.size, modified: f.modified, status: pending, error: pendingError })
    }
    if (needsRemoveSrc) {
      items.push({ action: "remove_src", rel_path: path, size: f.size, status: pending, error: pendingError })
    }
  }

  if (cfg.method === "mirror") {
    for (let ti = 0; ti < targets.length; ti++) {
      const tm = targets[ti]
      if (!tm) continue
      for (const [name, f] of tm) {
        const path = `${rel}/${name}`
        if (src.has(name) || excluded(path)) continue
        const allowed = cfg.allow_delete && notes.length === 0
        items.push({
          action: "delete",
          rel_path: path,
          target: ti,
          size: f.is_dir ? 0 : f.size,
          detail: f.is_dir ? "dir" : "",
          status: allowed ? pending : "skipped",
          error: !cfg.allow_delete ? "deletion is not enabled for this job" : notes.length ? notes[0] : pendingError,
        })
      }
    }
  }

  for (const name of childScan) {
    const path = `${rel}/${name}`
    const miss = [...missing, ...(childMissing.get(name) || [])].filter((ti) => targets[ti] !== null)
    items.push({ action: "scan", rel_path: path, detail: JSON.stringify([...new Set(miss)]) })
  }

  let files = 0
  for (const f of src.values()) if (!f.is_dir) files++
  const stmts = [
    ...insertItemStatements(t.db, run.id, items, now),
    t.db
      .prepare(
        "UPDATE sync_runs SET scanned_files = scanned_files + ?, scanned_dirs = scanned_dirs + 1, delete_blocked = CASE WHEN ? != '' THEN ? ELSE delete_blocked END WHERE id = ?",
      )
      .bind(files, notes[0] || "", notes[0] || "", run.id),
    t.db.prepare("UPDATE sync_items SET status = 'done', updated_at = ? WHERE id = ?").bind(now, scan.id),
  ]
  // The scan item is marked done in the last batch, so a crash before it only re-runs this folder
  for (let i = 0; i < stmts.length; i += 50) await t.q(t.db.batch(stmts.slice(i, i + 50)))
  return "ok"
}

/** Mirror deletions run only after a complete, healthy scan. */
async function blockDeletionsIfUnsafe(t: Tick, runId: number) {
  const run = await t.q(getRun(t.db, runId))
  if (!run) return
  const failed = await t.q(
    t.db.prepare("SELECT COUNT(*) AS n FROM sync_items WHERE run_id = ? AND action = 'scan' AND status = 'failed'").bind(runId).first(),
  )
  const reason = run.delete_blocked || (Number(failed?.n) > 0 ? "some folders could not be listed; deletions are disabled for this run" : "")
  if (!reason) return
  await t.q(
    t.db
      .prepare("UPDATE sync_items SET status = 'skipped', error = ?, updated_at = ? WHERE run_id = ? AND action = 'delete' AND status = 'pending'")
      .bind(reason, Date.now(), runId)
      .run(),
  )
}

const RANK_SQL = "CASE action WHEN 'mkdir' THEN 0 WHEN 'remove_src' THEN 2 ELSE 1 END"

/** Executes one small group of pending items; returns false once nothing is pending. */
async function transferStep(t: Tick, run: SyncRun): Promise<boolean> {
  const { results } = await t.q(
    t.db
      .prepare(
        `SELECT *, ${RANK_SQL} AS rank FROM sync_items WHERE run_id = ? AND status = 'pending' AND action != 'scan' ORDER BY rank, id LIMIT ?`,
      )
      .bind(run.id, GROUP_SIZE)
      .all(),
  )
  const rows = (results || []) as Array<SyncItem & { rank: number }>
  if (rows.length === 0) return false
  // Folders first, then files, then source removals, so each group only holds one kind of dependency
  const group = rows.filter((r) => r.rank === rows[0].rank)
  const ids = group.map((r) => r.id)
  await t.q(
    t.db
      .prepare(`UPDATE sync_items SET status = 'running', updated_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(Date.now(), ...ids)
      .run(),
  )
  const outcomes = await Promise.all(group.map((it) => runItem(t, run, it)))
  const now = Date.now()
  await t.q(
    t.db.batch(
      outcomes.map((o, i) =>
        t.db.prepare("UPDATE sync_items SET status = ?, mode = ?, error = ?, updated_at = ? WHERE id = ?").bind(o.status, o.mode, o.error, now, group[i].id),
      ),
    ),
  )
  return true
}

interface Outcome {
  status: "done" | "failed" | "skipped"
  mode: string
  error: string
}

async function runItem(t: Tick, run: SyncRun, it: SyncItem): Promise<Outcome> {
  const cfg = run.config
  const srcPath = join(cfg.src, it.rel_path)
  const dstPath = it.target >= 0 ? join(cfg.dsts[it.target], it.rel_path) : ""
  try {
    switch (it.action) {
      case "mkdir":
        await mkdirMount(dstPath, t.env)
        return { status: "done", mode: "", error: "" }
      case "delete":
        await removeMount(dstPath, t.env)
        return { status: "done", mode: "", error: "" }
      case "copy": {
        // Node-side copies finish in the background and are only confirmed by the next run's scan,
        // so move jobs always relay and verify before the source is removed
        if (cfg.method !== "move" && (await sameNode(srcPath, dstPath, t.env))) {
          await serverCopy(srcPath, dstPath, t.env)
          return { status: "done", mode: "server", error: "" }
        }
        const mode = await relayFile(srcPath, dstPath, it.size, it.modified, t.env, t.abort.signal)
        return { status: "done", mode, error: "" }
      }
      case "remove_src":
        return await removeSource(t, run, it, srcPath)
      default:
        return { status: "skipped", mode: "", error: `unknown action ${it.action}` }
    }
  } catch (e: any) {
    const msg = t.abort.signal.aborted
      ? `did not finish within one invocation's time limit (${Math.round(t.budget.hardMs / 60000)} min); the file is too large or the link too slow`
      : String(e?.message || e)
    return { status: "failed", mode: "", error: msg }
  }
}

async function removeSource(t: Tick, run: SyncRun, it: SyncItem, srcPath: string): Promise<Outcome> {
  const cfg = run.config
  const copies = await t.q(
    t.db
      .prepare("SELECT status FROM sync_items WHERE run_id = ? AND action = 'copy' AND rel_path = ?")
      .bind(run.id, it.rel_path)
      .all(),
  )
  const rows = copies.results || []
  if (rows.some((r: any) => r.status !== "done")) {
    return { status: "skipped", mode: "", error: "kept the source because a copy to a target did not succeed" }
  }
  for (let ti = 0; ti < cfg.dsts.length; ti++) {
    const st = await statMount(join(cfg.dsts[ti], it.rel_path), t.env)
    if (!st || st.is_dir || st.size !== it.size) {
      return { status: "skipped", mode: "", error: `kept the source because ${cfg.dsts[ti]} does not hold a copy of the same size` }
    }
  }
  await removeMount(srcPath, t.env)
  return { status: "done", mode: "", error: "" }
}

async function finishRun(t: Tick, run: SyncRun, forced?: "stopped" | "failed", error = "") {
  const now = Date.now()
  if (forced) {
    await t.q(
      t.db
        .prepare("UPDATE sync_items SET status = 'skipped', error = ?, updated_at = ? WHERE run_id = ? AND status IN ('pending', 'running')")
        .bind(forced === "stopped" ? "run stopped" : "run failed", now, run.id)
        .run(),
    )
  }
  const counts = await t.q(countItems(t.db, run.id))
  const state = forced ?? (counts.failed > 0 ? (counts.done > 0 ? "partial" : "failed") : "success")
  const job = await t.q(t.db.prepare("SELECT * FROM sync_jobs WHERE id = ?").bind(run.job_id).first())
  const stmts = [
    t.db
      .prepare("UPDATE sync_runs SET state = ?, phase = 'done', finished_at = ?, summary = ?, error = CASE WHEN ? != '' THEN ? ELSE error END WHERE id = ?")
      .bind(state, now, JSON.stringify(counts), error, error, run.id),
  ]
  if (job) {
    const j = rowToJob(job)
    const next = j.enabled ? nextRunAfter(j, now) : null
    stmts.push(t.db.prepare("UPDATE sync_jobs SET next_run_at = ? WHERE id = ? AND next_run_at IS NULL").bind(next, j.id))
  }
  stmts.push(
    t.db
      .prepare(
        "DELETE FROM sync_items WHERE run_id IN (SELECT id FROM sync_runs WHERE job_id = ? AND id NOT IN (SELECT id FROM sync_runs WHERE job_id = ? ORDER BY id DESC LIMIT ?))",
      )
      .bind(run.job_id, run.job_id, KEEP_RUNS_PER_JOB),
    t.db
      .prepare("DELETE FROM sync_runs WHERE job_id = ? AND id NOT IN (SELECT id FROM sync_runs WHERE job_id = ? ORDER BY id DESC LIMIT ?)")
      .bind(run.job_id, run.job_id, KEEP_RUNS_PER_JOB),
  )
  await t.q(t.db.batch(stmts))
}

/** Stops a run: flags it, then finalizes right away when no invocation currently holds it. */
export async function stopRun(env: any, runId: number): Promise<void> {
  const db = getSyncDb(env)!
  await db.prepare("UPDATE sync_runs SET stop_requested = 1 WHERE id = ? AND state = 'running'").bind(runId).run()
  await syncTick(env, REQUEST_BUDGET, false, runId)
}
