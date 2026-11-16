import { computed, reactive } from "vue"
import { START_LOCATION, type Router } from "vue-router"
import { restoreScroll, scrollOffset, scrollToTop } from "./scroll"

export interface Tab {
  id: string
  history: string[]
  index: number
}

const STORAGE_KEY = "ui.tabs"
const MAX_HISTORY = 50
// Console pages that live in a single tab each
const SINGLETONS = ["/@manage", "/@tasks", "/@shares"]
const NON_PAGE_PREFIXES = ["/api", "/d", "/sd", "/p", "/dav", "/s3", "/assets"]

interface State {
  tabs: Tab[]
  active: string
}

function load(): State {
  try {
    const raw = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null")
    const tabs: Tab[] = (raw?.tabs ?? []).filter(
      (t: Tab) =>
        typeof t?.id === "string" &&
        Array.isArray(t.history) &&
        t.history.length > 0 &&
        t.history.every((h) => typeof h === "string") &&
        t.index >= 0 &&
        t.index < t.history.length,
    )
    if (tabs.length) return { tabs, active: tabs.some((t) => t.id === raw.active) ? raw.active : tabs[0].id }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { tabs: [], active: "" }
}

export const state = reactive<State>(load())

function save() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* storage unavailable */
  }
}

export const activeTab = computed(() => state.tabs.find((t) => t.id === state.active))
export const canGoBack = computed(() => (activeTab.value?.index ?? 0) > 0)
export const canGoForward = computed(() => {
  const tab = activeTab.value
  return !!tab && tab.index < tab.history.length - 1
})

export function tabLocation(tab: Tab): string {
  return tab.history[tab.index]
}

export function singletonOf(location: string): string | null {
  const path = location.split(/[?#]/)[0]
  return SINGLETONS.find((s) => path === s || path.startsWith(s + "/")) ?? null
}

const offsets = new Map<string, number>()
const offsetKey = (tab: Tab) => `${tab.id}:${tab.index}`

function rememberOffset() {
  const tab = activeTab.value
  if (tab) offsets.set(offsetKey(tab), scrollOffset())
}

function forgetOffsets(tabId: string) {
  for (const key of offsets.keys()) if (key.startsWith(`${tabId}:`)) offsets.delete(key)
}

let router: Router
// Set while the store itself drives the router, so its guards stay out of the way
let internal = false

function create(location: string): Tab {
  const tab: Tab = { id: crypto.randomUUID(), history: [location], index: 0 }
  state.tabs.push(tab)
  return tab
}

async function show(tab: Tab) {
  internal = true
  try {
    const failure = await router.replace(tabLocation(tab))
    // A redirect may have changed the final location
    if (!failure) tab.history[tab.index] = router.currentRoute.value.fullPath
  } finally {
    internal = false
  }
  restoreScroll(offsets.get(offsetKey(tab)) ?? 0)
  save()
}

export function activateTab(id: string) {
  const tab = state.tabs.find((t) => t.id === id)
  if (!tab || state.active === id) return
  rememberOffset()
  state.active = id
  save()
  void show(tab)
}

/** Opens a location in a new tab, or focuses the tab that already owns it for console pages. */
export function openTab(location: string, activate = true) {
  const kind = singletonOf(location)
  const existing = kind ? state.tabs.find((t) => singletonOf(tabLocation(t)) === kind) : undefined
  if (existing) {
    if (activate) activateTab(existing.id)
    return
  }
  const tab = create(location)
  if (activate) {
    rememberOffset()
    state.active = tab.id
    void show(tab)
  }
  save()
}

export function closeTab(id: string) {
  const index = state.tabs.findIndex((t) => t.id === id)
  if (index < 0) return
  const wasActive = state.active === id
  state.tabs.splice(index, 1)
  forgetOffsets(id)
  if (!state.tabs.length) {
    openTab("/")
    return
  }
  if (wasActive) {
    const next = state.tabs[Math.min(index, state.tabs.length - 1)]
    state.active = next.id
    void show(next)
  }
  save()
}

function go(delta: number) {
  const tab = activeTab.value
  if (!tab || tab.index + delta < 0 || tab.index + delta >= tab.history.length) return
  rememberOffset()
  tab.index += delta
  void show(tab)
}

export const goBack = () => go(-1)
export const goForward = () => go(1)

function internalTarget(a: HTMLAnchorElement): string | null {
  if (a.target === "_blank" || a.hasAttribute("download") || a.origin !== location.origin) return null
  const path = decodeURI(a.pathname)
  if (path.startsWith("/@login")) return null
  if (!path.startsWith("/@") && NON_PAGE_PREFIXES.some((p) => path === p || path.startsWith(p + "/"))) return null
  return a.pathname + a.search + a.hash
}

function anchorOf(event: MouseEvent): string | null {
  const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]")
  return anchor ? internalTarget(anchor) : null
}

function onLinkEvent(event: MouseEvent) {
  const wanted = event.type === "click" ? event.button === 0 && (event.ctrlKey || event.metaKey) : event.button === 1
  if (!wanted || event.defaultPrevented) return
  const target = anchorOf(event)
  if (!target) return
  event.preventDefault()
  openTab(target, false)
}

export function installTabs(r: Router) {
  router = r
  // The tab that was showing when the current user-driven navigation started
  let leaving: string | null = null

  r.beforeEach((to, from) => {
    if (internal || from === START_LOCATION) return
    if (leaving === null) {
      rememberOffset()
      leaving = state.active
    }
    const kind = singletonOf(to.fullPath)
    if (!kind) return
    const active = activeTab.value
    if (active && singletonOf(tabLocation(active)) === kind) return
    const existing = state.tabs.find((t) => singletonOf(tabLocation(t)) === kind)
    if (existing) {
      state.active = existing.id
      return tabLocation(existing)
    }
    state.active = create(to.fullPath).id
  })

  r.afterEach((to, from, failure) => {
    const left = leaving
    leaving = null
    if (internal || failure || to.path === "/@login") return
    const location = to.fullPath
    const tab = activeTab.value
    if (!tab) {
      state.active = create(location).id
    } else if (tabLocation(tab) !== location) {
      if (to.redirectedFrom && tabLocation(tab) === to.redirectedFrom.fullPath) {
        tab.history[tab.index] = location
      } else {
        tab.history.splice(tab.index + 1, Infinity, location)
        tab.index = tab.history.length - 1
        offsets.delete(offsetKey(tab))
        if (tab.history.length > MAX_HISTORY) {
          tab.history.shift()
          tab.index--
          forgetOffsets(tab.id)
        }
      }
    }
    const kind = singletonOf(location)
    if (kind) state.tabs = state.tabs.filter((t) => t.id === state.active || singletonOf(tabLocation(t)) !== kind)
    const shown = activeTab.value
    if (shown && left !== null && left !== shown.id) restoreScroll(offsets.get(offsetKey(shown)) ?? 0)
    else if (to.path !== from.path) scrollToTop()
    save()
  })

  document.addEventListener("click", onLinkEvent, true)
  document.addEventListener("auxclick", onLinkEvent, true)
  // Stops the middle-button autoscroll cursor on links
  document.addEventListener(
    "mousedown",
    (e) => {
      if (e.button === 1 && anchorOf(e)) e.preventDefault()
    },
    true,
  )
}
