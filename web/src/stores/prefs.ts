import { computed, reactive, watch } from "vue"
import { detectLocale, isLocale, type Locale } from "@/i18n/locales"

export type ThemeMode = "light" | "dark" | "system"
export type ViewMode = "list" | "grid"
export type SortKey = "name" | "size" | "modified" | "type"
export type SortOrder = "asc" | "desc"
export type GroupKey = "none" | "name" | "modified" | "type" | "size"

export interface Arrange {
  sortKey: SortKey
  sortOrder: SortOrder
  groupKey: GroupKey
  groupOrder: SortOrder
}

interface Prefs {
  theme: ThemeMode
  locale: Locale
  view: ViewMode
  arrange: Arrange
  sidebar: { collapsed: string[] }
}

const STORAGE_KEY = "ui.prefs"
const defaults: Prefs = { theme: "system", locale: detectLocale(navigator.language), view: "list", arrange: { sortKey: "modified", sortOrder: "desc", groupKey: "none", groupOrder: "asc" }, sidebar: { collapsed: [] } }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const stored = { ...defaults, ...JSON.parse(raw) } as Prefs
      if (!isLocale(stored.locale)) stored.locale = defaults.locale
      return stored
    }
  } catch {
    /* storage unavailable or corrupt */
  }
  return { ...defaults }
}

export const prefs = reactive<Prefs>(load())

watch(prefs, (value) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
})

const media = window.matchMedia("(prefers-color-scheme: dark)")
const systemDark = reactive({ value: media.matches })
media.addEventListener("change", (e) => (systemDark.value = e.matches))

export const resolvedTheme = computed<"light" | "dark">(() =>
  prefs.theme === "system" ? (systemDark.value ? "dark" : "light") : prefs.theme,
)

// Theme tokens also live on <html> so overscroll and the page background match the app
export function bindThemeToDocument(): void {
  watch(
    resolvedTheme,
    (mode) => {
      document.documentElement.dataset.fluentTheme = mode
    },
    { immediate: true },
  )
}

export function toggleTheme(): void {
  prefs.theme = resolvedTheme.value === "dark" ? "light" : "dark"
}

export function toggleSort(key: SortKey): void {
  const arrange = prefs.arrange
  if (arrange.sortKey === key) {
    arrange.sortOrder = arrange.sortOrder === "asc" ? "desc" : "asc"
  } else {
    arrange.sortKey = key
    arrange.sortOrder = key === "modified" || key === "size" ? "desc" : "asc"
  }
}

export function setGroupKey(key: GroupKey): void {
  prefs.arrange.groupKey = key
  prefs.arrange.groupOrder = key === "modified" ? "desc" : "asc"
}
