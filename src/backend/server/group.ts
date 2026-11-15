import { Hono } from "hono"
import { getDb, saveDb } from "../internal/model/db"
import { normalizeSegments, type PermissionScope } from "../pkg/permission"

export const groupRouter = new Hono()

const fail = (c: any, message: string, status: 400 | 404 = 400) =>
  c.json({ code: status, message, data: null }, status)

/** 校验并规范化请求体中的用户组字段；失败返回错误信息。 */
function parseGroupBody(
  db: any,
  body: any,
  selfId?: number,
):
  | { error: string }
  | { name: string; description: string; scopes: PermissionScope[] } {
  const name = typeof body?.name === "string" ? body.name.trim() : ""
  if (!name) return { error: "Name is required" }
  if ((db.groups || []).some((g: any) => g.id !== selfId && g.name === name)) {
    return { error: "Group name already exists" }
  }
  const rawScopes = body?.scopes ?? []
  if (!Array.isArray(rawScopes)) return { error: "scopes must be an array" }
  const scopes: PermissionScope[] = []
  for (const s of rawScopes) {
    if (typeof s?.path !== "string" || !s.path.trim()) {
      return { error: "Scope path is required" }
    }
    const permission = Number(s.permission)
    if (!Number.isInteger(permission) || permission < 0) {
      return { error: "Scope permission must be a non-negative integer" }
    }
    scopes.push({ path: normalizeSegments(s.path), permission })
  }
  return {
    name,
    description: typeof body?.description === "string" ? body.description : "",
    scopes,
  }
}

const toGroup = (g: any) => ({
  id: g.id,
  name: g.name,
  description: g.description || "",
  scopes: g.scopes || [],
})

// GET /api/admin/group/list
groupRouter.get("/list", async (c) => {
  const db = await getDb(c.env)
  const content = (db.groups || []).map(toGroup)
  return c.json({
    code: 200,
    message: "success",
    data: { content, total: content.length },
  })
})

// GET /api/admin/group/get?id=
groupRouter.get("/get", async (c) => {
  const id = parseInt(c.req.query("id") || "", 10)
  if (!Number.isInteger(id)) return fail(c, "Missing id parameter")
  const db = await getDb(c.env)
  const group = (db.groups || []).find((g: any) => g.id === id)
  if (!group) return fail(c, "Group not found", 404)
  return c.json({ code: 200, message: "success", data: toGroup(group) })
})

// POST /api/admin/group/create
groupRouter.post("/create", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const db = await getDb(c.env)
  if (!db.groups) db.groups = []
  const parsed = parseGroupBody(db, body)
  if ("error" in parsed) return fail(c, parsed.error)
  const id = db.groups.reduce((m: number, g: any) => Math.max(m, g.id || 0), 0) + 1
  const group = { id, ...parsed }
  db.groups.push(group)
  await saveDb(db, c.env)
  return c.json({ code: 200, message: "success", data: toGroup(group) })
})

// POST /api/admin/group/update
groupRouter.post("/update", async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const id = parseInt(body?.id, 10)
  if (!Number.isInteger(id)) return fail(c, "Group ID is required")
  const db = await getDb(c.env)
  const idx = (db.groups || []).findIndex((g: any) => g.id === id)
  if (idx === -1) return fail(c, "Group not found", 404)
  const parsed = parseGroupBody(db, body, id)
  if ("error" in parsed) return fail(c, parsed.error)
  db.groups[idx] = { id, ...parsed }
  await saveDb(db, c.env)
  return c.json({ code: 200, message: "success", data: toGroup(db.groups[idx]) })
})

// POST /api/admin/group/delete?id=
groupRouter.post("/delete", async (c) => {
  const id = parseInt(c.req.query("id") || "", 10)
  if (!Number.isInteger(id)) return fail(c, "Missing id parameter")
  const db = await getDb(c.env)
  if (!(db.groups || []).some((g: any) => g.id === id)) {
    return fail(c, "Group not found", 404)
  }
  db.groups = db.groups.filter((g: any) => g.id !== id)
  for (const u of db.users || []) {
    if (Array.isArray(u.groups)) u.groups = u.groups.filter((g: number) => g !== id)
  }
  await saveDb(db, c.env)
  return c.json({ code: 200, message: "success", data: null })
})
