import type { Context, Next } from "hono"

const BLOCKED = /^\/(?:dav|s3)(?:\/|$)|^\/api\/auth\/login(?:\/|$)|^\/api\/authn\/webauthn_(?:begin|finish)_login(?:\/|$)/

function enabled(c: Context): boolean {
  const env = (c.env || {}) as any
  const value = env.SSO_ONLY ?? (typeof process !== "undefined" ? process.env?.SSO_ONLY : "")
  return value === "true" || value === "1"
}

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
    return c.redirect("/api/auth/sso?method=sso_get_token", 302)
  }
  return next()
}
