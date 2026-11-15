import { computed, reactive } from "vue"
import { api, ApiError, clearToken, getToken, setUnauthorizedHandler, type SiteSettings, type UserInfo } from "@/api"
import { t } from "@/i18n"
import { notify } from "@/stores/toast"

const RETURN_KEY = "login.return"

export const session = reactive<{
  settings: SiteSettings | null
  user: UserInfo | null
  ready: boolean
  unreachable: boolean
}>({ settings: null, user: null, ready: false, unreachable: false })

export const siteTitle = computed(() => session.settings?.site_title || t("shell.siteFallback"))
export const isGuest = computed(() => !session.user || session.user.username === "guest")
export const basePath = computed(() => session.user?.base_path || "/")

// Roles: 0 general, 1 guest, 2 admin
const roles = computed(() => [session.user?.role ?? 1].flat())
export const isAdmin = computed(() => roles.value.includes(2))
export const roleLabel = computed(() =>
  isAdmin.value ? t("shell.roles.admin") : roles.value.includes(0) ? t("shell.roles.user") : t("shell.roles.guest"),
)

export function safeReturnPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/")) return null
  if (path.startsWith("//") || path.startsWith("/\\") || path.startsWith("/@login")) return null
  return path
}

let expiredToken = ""

// Dropping the token is deferred so a caller that retries as guest can still see it
setUnauthorizedHandler((token) => {
  if (expiredToken === token) return
  expiredToken = token
  if (location.pathname !== "/@login") notify(t("shell.session.expired"), "info")
  setTimeout(() => {
    if (getToken() !== token) return
    clearToken()
    void loadUser()
  }, 0)
})

function isUnreachable(err: unknown): boolean {
  return err instanceof ApiError && err.kind === "network"
}

export async function loadUser(): Promise<void> {
  try {
    session.user = await api.me()
    return
  } catch (err) {
    if (isUnreachable(err)) {
      session.user = null
      session.unreachable = true
      return
    }
  }
  // An expired token must not lock the visitor out of public content
  if (getToken()) {
    clearToken()
    try {
      session.user = await api.me()
      return
    } catch {
      /* fall through */
    }
  }
  session.user = null
}

export async function loadSession(): Promise<void> {
  session.unreachable = false
  const settings = api
    .settings()
    .then((value) => (session.settings = value))
    .catch((err) => {
      if (isUnreachable(err)) session.unreachable = true
    })
  await Promise.all([settings, loadUser()])
  session.ready = true
}

export function rememberReturnPath(path: string): void {
  try {
    sessionStorage.setItem(RETURN_KEY, path)
  } catch {
    /* storage unavailable */
  }
}

export function takeReturnPath(): string {
  try {
    const path = sessionStorage.getItem(RETURN_KEY)
    sessionStorage.removeItem(RETURN_KEY)
    return safeReturnPath(path) ?? "/"
  } catch {
    return "/"
  }
}

export async function logout(): Promise<void> {
  try {
    await api.logout()
  } catch {
    /* the token is dropped locally either way */
  }
  clearToken()
  location.reload()
}
