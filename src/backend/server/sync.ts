import { Hono } from "hono"
import { nextRunAfter, parseJobConfig, previewRuns } from "../internal/sync/config"
import { REQUEST_BUDGET, startRun, stopRun, syncTick } from "../internal/sync/engine"
import {
  countItems,
  ensureSyncSchema,
  getActiveRun,
  getJob,
  getRun,
  getSyncDb,
  rowToJob,
  rowToRun,
  type D1Like,
} from "../internal/sync/store"

type Env = { Variables: { syncDb: D1Like } }

/** Mounted under the admin router, which already enforces admin auth. */
export const syncRouter = new Hono<Env>()

const ok = (c: any, data: unknown = null) => c.json({ code: 200, message: "success", data })
const fail = (c: any, status: 400 | 404 | 409 | 500, message: string) => c.json({ code: status, message, data: null }, status)

syncRouter.use("*", async (c, next) => {
  const db = getSyncDb(c.env)
  if (!db) return fail(c, 500, "scheduled sync needs a D1 database binding (DB)")
  await ensureSyncSchema(db)
  c.set("syncDb", db)
  await next()
})

const idParam = (c: any, name = "id") => {
  const n = Number(c.req.query(name))
  return Number.isInteger(n) && n > 0 ? n : 0
}

const paging = (c: any) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1)
  const perPage = Math.min(200, Math.max(1, Number(c.req.query("per_page")) || 50))
  return { page, perPage, offset: (page - 1) * perPage }
}

function kick(c: any, runId: number) {
  const work = syncTick(c.env, REQUEST_BUDGET, false, runId).catch((e) => console.error("[sync] kick failed", e))
  try {
    c.executionCtx.waitUntil(work)
  } catch {
    // Without an execution context the next cron tick picks the run up
  }
}

async function runView(db: D1Like, run: ReturnType<typeof rowToRun>) {
  return { ...run, counts: run.summary ?? (await countItems(db, run.id)) }
}

syncRouter.get("/jobs", async (c) => {
  const db = c.get("syncDb")
  const { results } = await db
    .prepare(
      `SELECT j.*, r.id AS run_id, r.state AS run_state, r.dry_run AS run_dry, r.started_at AS run_started, r.finished_at AS run_finished, r.summary AS run_summary
       FROM sync_jobs j LEFT JOIN sync_runs r ON r.id = (SELECT MAX(id) FROM sync_runs WHERE job_id = j.id AND dry_run = 0)
       ORDER BY j.id`,
    )
    .all()
  const content = (results || []).map((r: any) => ({
    ...rowToJob(r),
    last_run: r.run_id
      ? {
          id: r.run_id,
          state: r.run_state,
          started_at: r.run_started,
          finished_at: r.run_finished,
          counts: r.run_summary ? JSON.parse(r.run_summary) : null,
        }
      : null,
  }))
  return ok(c, { content, total: content.length })
})

syncRouter.get("/job", async (c) => {
  const job = await getJob(c.get("syncDb"), idParam(c))
  return job ? ok(c, job) : fail(c, 404, "job not found")
})

syncRouter.post("/job/create", async (c) => {
  const db = c.get("syncDb")
  const body = await c.req.json().catch(() => ({}))
  let cfg
  try {
    cfg = parseJobConfig(body)
  } catch (e: any) {
    return fail(c, 400, e.message)
  }
  const now = Date.now()
  const enabled = body.enabled !== false
  const row = await db
    .prepare(
      `INSERT INTO sync_jobs (name, src, dsts, method, allow_delete, exclude, schedule_kind, interval_min, cron, timezone, enabled, next_run_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(
      cfg.name,
      cfg.src,
      JSON.stringify(cfg.dsts),
      cfg.method,
      cfg.allow_delete ? 1 : 0,
      cfg.exclude,
      cfg.schedule_kind,
      cfg.interval_min,
      cfg.cron,
      cfg.timezone,
      enabled ? 1 : 0,
      enabled ? nextRunAfter(cfg, now) : null,
      now,
      now,
    )
    .first()
  return ok(c, rowToJob(row))
})

syncRouter.post("/job/update", async (c) => {
  const db = c.get("syncDb")
  const body = await c.req.json().catch(() => ({}))
  const job = await getJob(db, Number(body.id) || 0)
  if (!job) return fail(c, 404, "job not found")
  let cfg
  try {
    cfg = parseJobConfig(body)
  } catch (e: any) {
    return fail(c, 400, e.message)
  }
  const now = Date.now()
  const active = await getActiveRun(db, job.id)
  // A schedule change takes effect immediately unless a run is in flight; that run sets the next time when it ends
  const next = job.enabled && !active ? nextRunAfter(cfg, now) : job.next_run_at
  const row = await db
    .prepare(
      `UPDATE sync_jobs SET name = ?, src = ?, dsts = ?, method = ?, allow_delete = ?, exclude = ?, schedule_kind = ?, interval_min = ?, cron = ?, timezone = ?, next_run_at = ?, updated_at = ?
       WHERE id = ? RETURNING *`,
    )
    .bind(
      cfg.name,
      cfg.src,
      JSON.stringify(cfg.dsts),
      cfg.method,
      cfg.allow_delete ? 1 : 0,
      cfg.exclude,
      cfg.schedule_kind,
      cfg.interval_min,
      cfg.cron,
      cfg.timezone,
      next,
      now,
      job.id,
    )
    .first()
  return ok(c, rowToJob(row))
})

syncRouter.post("/job/delete", async (c) => {
  const db = c.get("syncDb")
  const id = idParam(c)
  if (!(await getJob(db, id))) return fail(c, 404, "job not found")
  if (await getActiveRun(db, id)) return fail(c, 409, "stop the running sync before deleting the job")
  await db.batch([
    db.prepare("DELETE FROM sync_items WHERE run_id IN (SELECT id FROM sync_runs WHERE job_id = ?)").bind(id),
    db.prepare("DELETE FROM sync_runs WHERE job_id = ?").bind(id),
    db.prepare("DELETE FROM sync_jobs WHERE id = ?").bind(id),
  ])
  return ok(c)
})

async function setEnabled(c: any, enabled: boolean) {
  const db: D1Like = c.get("syncDb")
  const job = await getJob(db, idParam(c))
  if (!job) return fail(c, 404, "job not found")
  const active = await getActiveRun(db, job.id)
  const next = enabled ? (active ? null : nextRunAfter(job, Date.now())) : null
  await db.prepare("UPDATE sync_jobs SET enabled = ?, next_run_at = ?, updated_at = ? WHERE id = ?").bind(enabled ? 1 : 0, next, Date.now(), job.id).run()
  return ok(c)
}

syncRouter.post("/job/enable", (c) => setEnabled(c, true))
syncRouter.post("/job/disable", (c) => setEnabled(c, false))

syncRouter.post("/job/run", async (c) => {
  const db = c.get("syncDb")
  const job = await getJob(db, idParam(c))
  if (!job) return fail(c, 404, "job not found")
  const run = await startRun(db, job, "manual", false)
  if (!run) return fail(c, 409, "this job is already running")
  kick(c, run.id)
  return ok(c, run)
})

syncRouter.post("/job/dry_run", async (c) => {
  const db = c.get("syncDb")
  const job = await getJob(db, idParam(c))
  if (!job) return fail(c, 404, "job not found")
  const run = await startRun(db, job, "manual", true)
  if (!run) return fail(c, 409, "this job is already running")
  // Scan inline so small trees answer with the full diff; larger ones finish on later ticks
  await syncTick(c.env, REQUEST_BUDGET, false, run.id)
  const fresh = await getRun(db, run.id)
  return ok(c, fresh ? await runView(db, fresh) : run)
})

syncRouter.post("/run/stop", async (c) => {
  const db = c.get("syncDb")
  const run = await getRun(db, idParam(c))
  if (!run) return fail(c, 404, "run not found")
  if (run.state === "running") await stopRun(c.env, run.id)
  const fresh = await getRun(db, run.id)
  return ok(c, fresh)
})

syncRouter.get("/runs", async (c) => {
  const db = c.get("syncDb")
  const jobId = idParam(c, "job_id")
  const { perPage, offset } = paging(c)
  const [list, total] = await db.batch([
    db.prepare("SELECT * FROM sync_runs WHERE job_id = ? ORDER BY id DESC LIMIT ? OFFSET ?").bind(jobId, perPage, offset),
    db.prepare("SELECT COUNT(*) AS n FROM sync_runs WHERE job_id = ?").bind(jobId),
  ])
  const content = await Promise.all((list.results || []).map((r: any) => runView(db, rowToRun(r))))
  return ok(c, { content, total: Number(total.results?.[0]?.n) || 0 })
})

syncRouter.get("/run", async (c) => {
  const db = c.get("syncDb")
  const run = await getRun(db, idParam(c))
  return run ? ok(c, await runView(db, run)) : fail(c, 404, "run not found")
})

const ITEM_STATUSES = new Set(["pending", "running", "done", "failed", "skipped"])

syncRouter.get("/run/items", async (c) => {
  const db = c.get("syncDb")
  const runId = idParam(c)
  const status = c.req.query("status") || ""
  const { perPage, offset } = paging(c)
  // Folder scans are bookkeeping; only failed ones are results worth showing
  let where = "run_id = ? AND (action != 'scan' OR status = 'failed')"
  const args: unknown[] = [runId]
  if (ITEM_STATUSES.has(status)) {
    where += " AND status = ?"
    args.push(status)
  }
  const [list, total] = await db.batch([
    db.prepare(`SELECT * FROM sync_items WHERE ${where} ORDER BY id LIMIT ? OFFSET ?`).bind(...args, perPage, offset),
    db.prepare(`SELECT COUNT(*) AS n FROM sync_items WHERE ${where}`).bind(...args),
  ])
  return ok(c, { content: list.results || [], total: Number(total.results?.[0]?.n) || 0 })
})

syncRouter.post("/schedule/preview", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  try {
    const cfg = parseJobConfig({ name: "preview", src: "/a", dsts: ["/b"], ...body, method: "copy", allow_delete: false })
    return ok(c, { next: previewRuns(cfg, Date.now()) })
  } catch (e: any) {
    return fail(c, 400, e.message)
  }
})
