import type { Context, Next } from "hono"

const BLOCKED = /^\/(?:dav|s3)(?:\/|$)|^\/api\/auth\/login(?:\/|$)|^\/api\/authn\/webauthn_(?:begin|finish)_login(?:\/|$)/

function enabled(c: Context): boolean {
  const env = (c.env || {}) as any
  const value = env.SSO_ONLY ?? (typeof process !== "undefined" ? process.env?.SSO_ONLY : "")
  return value === "true" || value === "1"
}

const SSO_START = "/api/auth/sso?method=sso_get_token"

// 前端路由在页面内切到登录页时不会发请求，由这段脚本接管跳转
const LOGIN_REDIRECT_SCRIPT = `<script>(function(){function go(){if(location.pathname==="/@login"&&!new URLSearchParams(location.search).has("token"))location.replace(${JSON.stringify(SSO_START)})}["pushState","replaceState"].forEach(function(k){var f=history[k];history[k]=function(){var r=f.apply(this,arguments);go();return r}});addEventListener("popstate",go);go()})()</script>`

/**
 * SSO_ONLY=true 时单点登录是唯一的登录方式：口令登录、WebAuthn 登录、
 * WebDAV 与 S3 网关一律拒绝，登录页直接进入 SSO 流程。
 */
export async function ssoOnlyGuard(c: Context, next: Next) {
  if (!enabled(c)) return next()
  const path = c.req.path
  if (BLOCKED.test(path)) {
    return c.json({ code: 403, message: "Single sign-on is the only login method", data: null }, 403)
  }
  if (c.req.method === "GET" && path === "/@login" && !c.req.query("token")) {
    return c.redirect(SSO_START, 302)
  }
  await next()
  const type = c.res.headers.get("Content-Type") || ""
  if (c.req.method !== "GET" || c.res.status !== 200 || !type.startsWith("text/html")) return
  const html = (await c.res.text()).replace("<head>", "<head>" + LOGIN_REDIRECT_SCRIPT)
  const headers = new Headers(c.res.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  c.res = new Response(html, { status: 200, headers })
}
