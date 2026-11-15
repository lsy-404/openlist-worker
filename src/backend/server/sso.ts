import { Hono } from "hono"
import { sign } from "hono/jwt"
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie"
import { getDb, saveDb } from "../internal/model/db"
import { getJwtSecret } from "./middlewares"
import { generateRandomPassword } from "./auth"
import { setUserPassword, passwordStampOf } from "../pkg/password"

/**
 * SSO 登录（OAuth2 授权码流 + OIDC）。
 *
 * 支持平台：Github / Microsoft / Google / Dingtalk / Casdoor / OIDC。
 * 纯 fetch + Web Crypto 实现，无外部依赖。OIDC 走 discovery，使用
 * state + nonce + PKCE(S256)，并按 JWKS 校验 id_token 的签名、iss、aud、
 * exp 与 nonce；身份取自校验后的 id_token.sub。
 *
 * 两种模式：
 *  - 默认（弹窗）：回调后 postMessage 回传 { token | sso_id } 给 opener 并关闭。
 *  - 兼容模式：redirect 到 /@login?token=... 或 /@manage?sso_id=...。
 */

export const ssoRouter = new Hono()

const FLOW_EXPIRE_SECONDS = 5 * 60
const FLOW_COOKIE = "openlist_sso_flow"

function getSetting(db: any, key: string, def = ""): string {
  const item = (db.settings || []).find((s: any) => s.key === key)
  if (!item || item.value === undefined || item.value === null) return def
  return String(item.value)
}

function getBool(db: any, key: string): boolean {
  const v = getSetting(db, key, "false")
  return v === "true" || v === "1"
}

function apiOrigin(c: any): string {
  try {
    return new URL(c.req.url).origin
  } catch {
    return "http://localhost"
  }
}

function base64Url(bytes: Uint8Array): string {
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function base64UrlDecode(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/")
  const bin = atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0))
}

function randomToken(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)))
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

interface OidcFlow {
  state: string
  nonce: string
  verifier: string
  method: string
  exp: number
}

const flowCookieOptions = { path: "/api/auth", httpOnly: true, secure: true, sameSite: "Lax" as const }

/** 登录流程状态放在签名 Cookie 里，回调落到任意 isolate 都能校验 */
async function startOidcFlow(c: any, method: string): Promise<OidcFlow> {
  const flow: OidcFlow = {
    state: randomToken(),
    nonce: randomToken(),
    verifier: randomToken(),
    method,
    exp: Math.floor(Date.now() / 1000) + FLOW_EXPIRE_SECONDS,
  }
  const value = base64Url(new TextEncoder().encode(JSON.stringify(flow)))
  await setSignedCookie(c, FLOW_COOKIE, value, await getJwtSecret(c), {
    ...flowCookieOptions,
    maxAge: FLOW_EXPIRE_SECONDS,
  })
  return flow
}

async function finishOidcFlow(c: any, method: string, state: string): Promise<OidcFlow | null> {
  const raw = await getSignedCookie(c, await getJwtSecret(c), FLOW_COOKIE)
  deleteCookie(c, FLOW_COOKIE, flowCookieOptions)
  if (!raw) return null
  let flow: OidcFlow
  try {
    flow = JSON.parse(new TextDecoder().decode(base64UrlDecode(raw)))
  } catch {
    return null
  }
  if (!flow?.state || !flow.nonce || !flow.verifier) return null
  if (flow.method !== method || flow.exp < Math.floor(Date.now() / 1000)) return null
  return sameText(flow.state, state) ? flow : null
}

const ID_TOKEN_ALGS: Record<string, { importParams: any; verifyParams: any }> = {
  RS256: {
    importParams: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    verifyParams: { name: "RSASSA-PKCS1-v1_5" },
  },
  ES256: {
    importParams: { name: "ECDSA", namedCurve: "P-256" },
    verifyParams: { name: "ECDSA", hash: "SHA-256" },
  },
}

/** 校验 id_token：JWKS 签名、iss、aud、exp、nonce；返回 claims */
async function verifyIdToken(idToken: string, ep: OidcEndpoints, clientId: string, nonce: string): Promise<any> {
  const parts = idToken.split(".")
  if (parts.length !== 3) throw new Error("malformed id_token")
  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])))
  const alg = ID_TOKEN_ALGS[header.alg]
  if (!alg) throw new Error("unsupported id_token algorithm")
  if (!ep.jwksUrl) throw new Error("OIDC provider has no jwks_uri")
  const jwksResp = await fetch(ep.jwksUrl, { headers: { Accept: "application/json" } })
  if (!jwksResp.ok) throw new Error(`OIDC jwks fetch failed: HTTP ${jwksResp.status}`)
  const jwks: any = await jwksResp.json()
  const candidates = (jwks.keys || []).filter(
    (k: any) => (!header.kid || k.kid === header.kid) && (!k.use || k.use === "sig") && (!k.alg || k.alg === header.alg),
  )
  const signed = new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  const signature = base64UrlDecode(parts[2])
  let verified = false
  for (const jwk of candidates) {
    try {
      const key = await crypto.subtle.importKey("jwk", jwk, alg.importParams, false, ["verify"])
      if (await crypto.subtle.verify(alg.verifyParams, key, signature as BufferSource, signed as BufferSource)) {
        verified = true
        break
      }
    } catch {
      // 该 key 与算法不匹配，继续尝试下一把
    }
  }
  if (!verified) throw new Error("id_token signature verification failed")
  const claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])))
  const now = Math.floor(Date.now() / 1000)
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (claims.iss !== ep.issuer) throw new Error("id_token issuer mismatch")
  if (!audience.includes(clientId)) throw new Error("id_token audience mismatch")
  if (typeof claims.exp !== "number" || claims.exp <= now) throw new Error("id_token expired")
  if (typeof claims.nonce !== "string" || !sameText(claims.nonce, nonce)) throw new Error("id_token nonce mismatch")
  if (!claims.sub) throw new Error("id_token has no sub")
  return claims
}

/** 平台预设端点 */
interface PlatformDef {
  authUrl: string
  tokenUrl: string
  userUrl: string
  scope: string
  authField: string
  idField: string
  usernameField: string
  extraAuth?: Record<string, string>
  extraForm?: Record<string, string>
  tokenStyle?: "form" | "json" // Dingtalk 用 JSON
}

function platformDef(platform: string, ssoLoginUrl: string, ssoTokenUrl: string, ssoUserinfoUrl: string, ssoScopes: string): PlatformDef | null {
  switch (platform) {
    case "Github":
      return {
        authUrl: "https://github.com/login/oauth/authorize",
        tokenUrl: "https://github.com/login/oauth/access_token",
        userUrl: "https://api.github.com/user",
        scope: ssoScopes || "read:user",
        authField: "code",
        idField: "id",
        usernameField: "login",
      }
    case "Microsoft":
      return {
        authUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userUrl: "https://graph.microsoft.com/v1.0/me",
        scope: ssoScopes || "user.read",
        authField: "code",
        idField: "id",
        usernameField: "displayName",
        extraAuth: { response_mode: "query" },
        extraForm: { grant_type: "authorization_code" },
      }
    case "Google":
      return {
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        userUrl: "https://www.googleapis.com/oauth2/v1/userinfo",
        scope: ssoScopes || "https://www.googleapis.com/auth/userinfo.profile",
        authField: "code",
        idField: "id",
        usernameField: "name",
        extraForm: { grant_type: "authorization_code" },
      }
    case "Dingtalk":
      return {
        authUrl: "https://login.dingtalk.com/oauth2/auth",
        tokenUrl: "https://api.dingtalk.com/v1.0/oauth2/userAccessToken",
        userUrl: "https://api.dingtalk.com/v1.0/contact/users/me",
        scope: ssoScopes || "openid",
        authField: "authCode",
        idField: "unionId",
        usernameField: "nick",
        extraAuth: { prompt: "consent" },
        tokenStyle: "json",
      }
    case "Casdoor":
      return {
        authUrl: (ssoLoginUrl || "").replace(/\/login\/oauth\/authorize$/, "") + "/login/oauth/authorize",
        tokenUrl: (ssoTokenUrl || "").replace(/\/api\/login\/oauth\/access_token$/, "") + "/api/login/oauth/access_token",
        userUrl: (ssoUserinfoUrl || "").replace(/\/api\/userinfo$/, "") + "/api/userinfo",
        scope: ssoScopes || "profile",
        authField: "code",
        idField: "sub",
        usernameField: "preferred_username",
        extraForm: { grant_type: "authorization_code" },
      }
    case "OIDC":
      return null // 走 discovery，单独处理
    default:
      return null
  }
}

interface OidcEndpoints {
  issuer: string
  authUrl: string
  tokenUrl: string
  userUrl: string
  jwksUrl: string
  basicAuth: boolean
}

/** OIDC discovery：获取端点、issuer、JWKS 与令牌端点认证方式 */
async function oidcDiscovery(discoveryUrl: string): Promise<OidcEndpoints> {
  const url = discoveryUrl.endsWith("/.well-known/openid-configuration")
    ? discoveryUrl
    : discoveryUrl.replace(/\/+$/, "") + "/.well-known/openid-configuration"
  const resp = await fetch(url, { headers: { Accept: "application/json" } })
  if (!resp.ok) throw new Error(`OIDC discovery failed: HTTP ${resp.status}`)
  const doc: any = await resp.json()
  if (!doc.issuer || !doc.authorization_endpoint || !doc.token_endpoint) {
    throw new Error("OIDC discovery returned incomplete metadata")
  }
  const authMethods: string[] = Array.isArray(doc.token_endpoint_auth_methods_supported)
    ? doc.token_endpoint_auth_methods_supported
    : ["client_secret_basic"]
  return {
    issuer: doc.issuer,
    authUrl: doc.authorization_endpoint,
    tokenUrl: doc.token_endpoint,
    userUrl: doc.userinfo_endpoint || "",
    jwksUrl: doc.jwks_uri || "",
    basicAuth: authMethods.includes("client_secret_basic"),
  }
}

/** 生成 JWT token（与 /auth/login 一致） */
async function generateToken(user: any, c: any): Promise<string> {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    // 密码指纹（对齐 Go PwdTS）：改密后旧令牌立即失效
    pwd_ts: passwordStampOf(user),
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
    jti:
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : generateRandomPassword(),
  }
  const secret = await getJwtSecret(c)
  return await sign(payload, secret)
}

/** 取 id_token 中的组声明：字符串数组，或单个字符串。 */
function groupsFromClaim(claims: any, claim: string): string[] {
  const raw = claims?.[claim]
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : []
  return [...new Set(list.filter((g: unknown) => typeof g === "string" && g).map(String))]
}

/** SSO 自动注册 */
async function autoRegister(
  db: any,
  username: string,
  ssoId: string,
  ssoGroups: string[] | undefined,
): Promise<any> {
  let uname = username || ssoId
  if (db.users.some((u: any) => u.username === uname)) {
    uname = `${uname}_${ssoId}`
  }
  const id = db.users.length
    ? Math.max(...db.users.map((u: any) => Number(u.id) || 0)) + 1
    : 1
  const user: any = {
    id,
    username: uname,
    password: "",
    role: 0,
    permission: 0,
    base_path: "/",
    disabled: false,
    sso_id: ssoId,
    allow_ldap: false,
    groups: [],
    sso_groups: ssoGroups ?? [],
    pwd_update_at: new Date().toISOString(),
  }
  // SSO 用户不通过本地口令登录，但仍以双层哈希存储随机口令，避免存明文
  await setUserPassword(user, generateRandomPassword())
  db.users.push(user)
  await saveDb(db, db.env)
  return user
}

function postMessageHtml(field: string, value: string, origin: string): string {
  const safe = String(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  return `<!DOCTYPE html>
<head></head>
<body>
<script>
window.opener.postMessage({"${field}":"${safe}"}, ${JSON.stringify(origin)})
window.close()
</script>
</body>`
}

// GET /api/auth/sso?method=sso_get_token | get_sso_id
ssoRouter.get("/sso", async (c) => {
  const db = await getDb(c.env)
  if (!getBool(db, "sso_login_enabled")) {
    return c.json({ code: 403, message: "Single sign-on is not enabled", data: null }, 403)
  }
  const method = c.req.query("method") || ""
  if (!method) {
    return c.json({ code: 400, message: "no method provided", data: null }, 400)
  }
  const platform = getSetting(db, "sso_login_platform")
  const clientId = getSetting(db, "sso_client_id")
  const useCompat = getBool(db, "sso_compatibility_mode")
  const redirectUri = useCompat
    ? `${apiOrigin(c)}/api/auth/${method}`
    : `${apiOrigin(c)}/api/auth/sso_callback?method=${method}`

  const ssoLoginUrl = getSetting(db, "sso_login_url")
  const ssoTokenUrl = getSetting(db, "sso_token_url")
  const ssoUserinfoUrl = getSetting(db, "sso_userinfo_url")
  const ssoScopes = getSetting(db, "sso_scopes")
  const discoveryUrl = getSetting(db, "sso_oidc_discovery_url")

  try {
    if (platform === "OIDC") {
      const ep = await oidcDiscovery(discoveryUrl || ssoLoginUrl)
      const flow = await startOidcFlow(c, method)
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: ssoScopes || "openid profile",
        state: flow.state,
        nonce: flow.nonce,
        code_challenge: await pkceChallenge(flow.verifier),
        code_challenge_method: "S256",
      })
      return c.redirect(`${ep.authUrl}?${params.toString()}`, 302)
    }

    const def = platformDef(platform, ssoLoginUrl, ssoTokenUrl, ssoUserinfoUrl, ssoScopes)
    if (!def) {
      return c.json({ code: 400, message: "invalid platform", data: null }, 400)
    }
    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: def.scope,
    })
    for (const [k, v] of Object.entries(def.extraAuth || {})) params.set(k, v)
    return c.redirect(`${def.authUrl}?${params.toString()}`, 302)
  } catch (e: any) {
    return c.json({ code: 400, message: e.message || "SSO error", data: null }, 400)
  }
})

// GET /api/auth/sso_callback?method=...&code=...
ssoRouter.get("/sso_callback", (c) => handleCallback(c, c.req.query("method") || ""))
// 兼容模式的回调地址：/api/auth/sso_get_token 与 /api/auth/get_sso_id
ssoRouter.get("/sso_get_token", (c) => handleCallback(c, "sso_get_token"))
ssoRouter.get("/get_sso_id", (c) => handleCallback(c, "get_sso_id"))

async function handleCallback(c: any, method: string) {
  const db = await getDb(c.env)
  if (!getBool(db, "sso_login_enabled")) {
    return c.text("Single sign-on is not enabled", 403)
  }
  if (method !== "get_sso_id" && method !== "sso_get_token") {
    return c.text("invalid request", 400)
  }
  const platform = getSetting(db, "sso_login_platform")
  const clientId = getSetting(db, "sso_client_id")
  const clientSecret = getSetting(db, "sso_client_secret")
  const useCompat = getBool(db, "sso_compatibility_mode")
  const redirectUri = useCompat
    ? `${apiOrigin(c)}/api/auth/${method}`
    : `${apiOrigin(c)}/api/auth/sso_callback?method=${method}`

  const ssoLoginUrl = getSetting(db, "sso_login_url")
  const ssoTokenUrl = getSetting(db, "sso_token_url")
  const ssoUserinfoUrl = getSetting(db, "sso_userinfo_url")
  const ssoScopes = getSetting(db, "sso_scopes")
  const discoveryUrl = getSetting(db, "sso_oidc_discovery_url")

  try {
    let tokenUrl: string
    let userUrl: string
    let idField: string
    let usernameField: string
    let scope: string
    let accessToken: string
    let userInfo: any
    let ssoGroups: string[] | undefined

    if (platform === "OIDC") {
      const ep = await oidcDiscovery(discoveryUrl || ssoLoginUrl)
      tokenUrl = ep.tokenUrl
      userUrl = ep.userUrl
      idField = "sub"
      usernameField = "preferred_username"
      scope = ssoScopes || "openid profile"
      const flow = await finishOidcFlow(c, method, c.req.query("state") || "")
      if (!flow) {
        return c.text("incorrect or expired state parameter", 400)
      }
      const code = c.req.query("code") || ""
      if (!code) return c.text("No code provided", 400)
      const form: Record<string, string> = {
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: flow.verifier,
      }
      const tokenHeaders: Record<string, string> = {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      }
      if (ep.basicAuth) {
        const credentials = `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`
        tokenHeaders["Authorization"] = `Basic ${btoa(credentials)}`
      } else {
        form.client_id = clientId
        form.client_secret = clientSecret
      }
      const tokenResp = await fetch(tokenUrl, {
        method: "POST",
        headers: tokenHeaders,
        body: new URLSearchParams(form).toString(),
      })
      const tokenData: any = await tokenResp.json().catch(() => ({}))
      if (!tokenData.id_token) {
        throw new Error(`token exchange failed: ${tokenData.error || tokenResp.status}`)
      }
      const claims = await verifyIdToken(tokenData.id_token, ep, clientId, flow.nonce)
      accessToken = tokenData.access_token || ""
      ssoGroups = groupsFromClaim(claims, getSetting(db, "sso_group_claim", "groups") || "groups")
      userInfo = { sub: claims.sub, name: claims.preferred_username || claims.name || "" }
      if (userUrl && accessToken && !userInfo.name) {
        const uResp = await fetch(userUrl, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        })
        const profile: any = await uResp.json().catch(() => ({}))
        if (profile?.sub === claims.sub) {
          userInfo.name = profile.preferred_username || profile.name || profile.nickname || ""
        }
      }
    } else {
      const def = platformDef(platform, ssoLoginUrl, ssoTokenUrl, ssoUserinfoUrl, ssoScopes)
      if (!def) return c.text("invalid platform", 400)
      tokenUrl = def.tokenUrl
      userUrl = def.userUrl
      idField = def.idField
      usernameField = def.usernameField
      scope = def.scope

      const code = c.req.query(def.authField) || ""
      if (!code) return c.text("No code provided", 400)

      let tokenResp: Response
      if (def.tokenStyle === "json") {
        // Dingtalk
        tokenResp = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            clientId,
            clientSecret,
            code,
            grantType: "authorization_code",
          }),
        })
      } else {
        const form: Record<string, string> = {
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          scope,
          ...(def.extraForm || {}),
        }
        tokenResp = await fetch(tokenUrl, {
          method: "POST",
          headers: { Accept: "application/json" },
          body: new URLSearchParams(form).toString(),
        })
      }
      const tokenData: any = await tokenResp.json().catch(() => ({}))
      accessToken = tokenData.access_token || tokenData.accessToken
      if (!accessToken) {
        throw new Error(`token exchange failed: ${tokenData.error || tokenResp.status}`)
      }

      const headers: Record<string, string> = { Accept: "application/json" }
      if (platform === "Dingtalk") {
        headers["x-acs-dingtalk-access-token"] = accessToken
      } else {
        headers["Authorization"] = `Bearer ${accessToken}`
      }
      const uResp = await fetch(userUrl, { headers })
      userInfo = await uResp.json().catch(() => ({}))
    }

    const userID =
      platform === "OIDC"
        ? String(userInfo?.sub ?? "")
        : String(userInfo?.id ?? userInfo?.sub ?? userInfo?.[idField] ?? "")
    if (!userID || userID === "0") {
      return c.text("cannot get user id from SSO provider", 400)
    }

    if (method === "get_sso_id") {
      if (useCompat) {
        return c.redirect(`${apiOrigin(c)}/@manage?sso_id=${encodeURIComponent(userID)}`, 302)
      }
      return c.html(postMessageHtml("sso_id", userID, apiOrigin(c)))
    }

    // sso_get_token
    let user = (db.users || []).find((u: any) => u.sso_id === userID)
    if (!user) {
      const autoReg = getBool(db, "sso_auto_register")
      if (!autoReg) {
        if (useCompat) return c.redirect(`${apiOrigin(c)}/@login?error=sso_denied`, 302)
        return c.text("user not found and auto register is disabled", 400)
      }
      const username = String(userInfo?.login ?? userInfo?.[usernameField] ?? userInfo?.name ?? "")
      user = await autoRegister(db, username || userID, userID, ssoGroups)
    } else if (
      ssoGroups &&
      user.role !== 2 &&
      JSON.stringify(user.sso_groups || []) !== JSON.stringify(ssoGroups)
    ) {
      user.sso_groups = ssoGroups
      await saveDb(db, c.env)
    }
    const token = await generateToken(user, c)
    if (useCompat) {
      return c.redirect(`${apiOrigin(c)}/@login?token=${encodeURIComponent(token)}`, 302)
    }
    return c.html(postMessageHtml("token", token, apiOrigin(c)))
  } catch (e: any) {
    return c.text(e.message || "SSO error", 500)
  }
}
