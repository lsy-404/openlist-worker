import test from "node:test"
import assert from "node:assert/strict"
import { routedOriginFetch } from "../src/backend/drivers/alist_v3/origin"

const routes = JSON.stringify([{ base: "https://base.example", lanes: [
  { url: "https://fast.example", bytesPerSecond: 100, key: true },
  { url: "https://wide.example", bytesPerSecond: 1000000 },
] }])
const env = { ALIST_ORIGIN_ROUTES: routes, ALIST_ORIGIN_KEY: "secret" }

test("size, health, safe failover and credentials", async () => {
  const oldFetch = globalThis.fetch
  const oldNow = Date.now
  let now = 1000
  const calls: { url: string; key: string | null; auth: string | null }[] = []
  Date.now = () => now
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = String(input)
    const headers = new Headers(init.headers)
    calls.push({ url, key: headers.get("X-OpenList-Origin-Key"), auth: headers.get("Authorization") })
    if (url.endsWith("/api/public/settings")) {
      now += url.includes("fast.example") ? 1 : 10
      return Response.json({ code: 200, data: {} })
    }
    if (url.includes("wide.example")) return new Response("bad", { status: 503 })
    return new Response("ok")
  }) as typeof fetch
  try {
    const response = await routedOriginFetch("https://base.example/d/file?sign=a", { headers: { Authorization: "token" } }, env, 100000, true)
    assert.equal(await response.text(), "ok")
    const transfers = calls.filter((x) => x.url.includes("/d/file"))
    assert.deepEqual(transfers.map((x) => new URL(x.url).host), ["wide.example", "fast.example"])
    assert.deepEqual(transfers.map((x) => x.key), [null, "secret"])
    assert.ok(transfers.every((x) => x.auth === "token"))
  } finally { globalThis.fetch = oldFetch; Date.now = oldNow }
})

test("upload is never replayed and an unavailable route never consumes it", async () => {
  const oldFetch = globalThis.fetch
  let transfers = 0
  let prepared = 0
  let healthy = false
  globalThis.fetch = (async (input: any) => {
    if (String(input).endsWith("/api/public/settings")) return Response.json({ code: healthy ? 200 : 500, data: {} })
    transfers++
    throw new Error("network")
  }) as typeof fetch
  try {
    await assert.rejects(routedOriginFetch("https://base.example/api/fs/put", { method: "PUT" }, env, 4, false, () => { prepared++ }))
    assert.equal(prepared, 0)
    healthy = true
    await assert.rejects(routedOriginFetch("https://base.example/api/fs/put", { method: "PUT" }, env, 4, false, () => { prepared++ }))
    assert.equal(prepared, 1)
    assert.equal(transfers, 1)
  } finally { globalThis.fetch = oldFetch }
})

test("unmatched origin preserves existing fetch behavior", async () => {
  const oldFetch = globalThis.fetch
  let called = ""
  globalThis.fetch = (async (input: any) => { called = String(input); return new Response("ok") }) as typeof fetch
  try {
    await routedOriginFetch("https://other.example/path", {}, env)
    assert.equal(called, "https://other.example/path")
  } finally { globalThis.fetch = oldFetch }
})

test("failed route cools down and is probed again after expiry", async () => {
  const oldFetch = globalThis.fetch
  const originalCaches = (globalThis as any).caches
  let now = 0
  const oldNow = Date.now
  const store = new Map<string, { body: string; expires: number }>()
  ;(globalThis as any).caches = { default: {
    async match(request: Request) {
      const entry = store.get(request.url)
      return entry && entry.expires > now ? new Response(entry.body) : undefined
    },
    async put(request: Request, response: Response) {
      const ttl = Number(response.headers.get("Cache-Control")?.match(/max-age=(\d+)/)?.[1])
      store.set(request.url, { body: await response.text(), expires: now + ttl * 1000 })
    },
  } }
  Date.now = () => now
  let probes = 0
  let failed = true
  globalThis.fetch = (async (input: any) => {
    if (String(input).endsWith("/api/public/settings")) {
      probes++
      return Response.json({ code: failed ? 500 : 200, data: {} })
    }
    return new Response("ok")
  }) as typeof fetch
  try {
    await assert.rejects(routedOriginFetch("https://base.example/d/a", {}, env))
    failed = false
    await assert.rejects(routedOriginFetch("https://base.example/d/a", {}, env))
    assert.equal(probes, 2)
    now += 10001
    assert.equal((await routedOriginFetch("https://base.example/d/a", {}, env)).status, 200)
    assert.equal(probes, 4)
  } finally { globalThis.fetch = oldFetch; (globalThis as any).caches = originalCaches; Date.now = oldNow }
})

test("configured origin cannot be replaced by a double-slash pathname", async () => {
  const oldFetch = globalThis.fetch
  let destination = ""
  let sentKey: string | null = null
  globalThis.fetch = (async (input: any, init: any) => {
    const url = String(input)
    if (url.endsWith("/api/public/settings")) return Response.json({ code: 200, data: {} })
    sentKey = new Headers(init.headers).get("X-OpenList-Origin-Key")
    destination = url
    return new Response("ok")
  }) as typeof fetch
  try {
    await routedOriginFetch("https://base.example//attacker.example/file", {}, env)
    assert.equal(new URL(destination).origin, "https://fast.example")
    assert.equal(new URL(destination).pathname, "//attacker.example/file")
    assert.equal(sentKey, "secret")
  } finally { globalThis.fetch = oldFetch }
})

test("mount routing strips the original node prefix and scopes download aliases", async () => {
  const { AListV3Driver } = await import("../src/backend/drivers/alist_v3/driver")
  const { hasOriginRoute } = await import("../src/backend/drivers/alist_v3/origin")
  const mountEnv = { ALIST_ORIGIN_ROUTES: JSON.stringify([{ mountPath: "/server/home", rawOrigins: ["https://download.example"], lanes: [{ url: "https://private.example", bytesPerSecond: 1000 }] }]) }
  const oldFetch = globalThis.fetch
  const urls: string[] = []
  globalThis.fetch = (async (input: any) => {
    const url = String(input); urls.push(url)
    if (url.endsWith("/api/public/settings")) return Response.json({ code: 200, data: {} })
    return Response.json({ code: 200, data: { name: "file", size: 1, is_dir: false, raw_url: "https://download.example/d/file" } })
  }) as typeof fetch
  try {
    const driver = new AListV3Driver({ url: "https://base.example/secret-prefix" }, undefined, () => mountEnv, "/server/home")
    await driver.get("/file", "/file")
    assert.ok(urls.includes("https://private.example/api/fs/get"))
    const context = { baseUrl: "https://base.example/secret-prefix", mountPath: "/server/home", kind: "raw" as const }
    assert.equal(hasOriginRoute("https://download.example/d/file", mountEnv, context), true)
    assert.equal(hasOriginRoute("https://other.example/d/file", mountEnv, context), false)
    assert.equal(hasOriginRoute("https://download.example/api/file", mountEnv, context), false)
    assert.equal(hasOriginRoute("https://download.example/d/file", mountEnv, { ...context, mountPath: "/different" }), false)
  } finally { globalThis.fetch = oldFetch }
})

test("download reports origin failure as 502 and blocked URLs as 403", async () => {
  const { proxyUpstream } = await import("../src/backend/server/raw")
  const oldFetch = globalThis.fetch
  globalThis.fetch = (async () => { throw new Error("unreachable") }) as typeof fetch
  const c: any = { env, req: { header: () => undefined }, text: (message: string, status: number) => new Response(message, { status }) }
  const options = { driver: "AListV3", storage: { mount_path: "/node", addition: JSON.stringify({ url: "https://base.example" }) } }
  try {
    const unavailable = await proxyUpstream(c, { raw_url: "https://base.example/d/file", size: 1 }, "/file", undefined, options)
    assert.equal(unavailable.status, 502)
    const blocked = await proxyUpstream(c, { raw_url: "http://127.0.0.1/d/file", size: 1 }, "/file", undefined, options)
    assert.equal(blocked.status, 403)
  } finally { globalThis.fetch = oldFetch }
})
