import { computed, reactive } from "vue"
import { api, clearToken, getToken, type SiteSettings, type UserInfo } from "@/api"

const RETURN_KEY = "login.return"

export const session = reactive<{
  settings: SiteSettings | null
  user: UserInfo | null
  ready: boolean
}>({ settings: null, user: null, ready: false })

export const siteTitle = computed(() => session.settings?.site_title || "OpenList")
export const isGuest = computed(() => !session.user || session.user.username === "guest")
export const basePath = computed(() => session.user?.base_path || "/")

export async function loadUser(): Promise<void> {
  try {
    session.user = await api.me()
  } catch {
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
}

export async function loadSession(): Promise<void> {
  void api.settings().then((settings) => (session.settings = settings)).catch(() => undefined)
  await loadUser()
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
    // Only same-origin absolute paths are valid return targets
    if (path && path.startsWith("/") && !path.startsWith("//")) return path
  } catch {
    /* storage unavailable */
  }
  return "/"
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
