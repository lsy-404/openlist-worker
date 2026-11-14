import { computed, reactive, watch } from "vue"

export type ThemeMode = "light" | "dark" | "system"
export type ViewMode = "list" | "grid"
export type SortKey = "name" | "size" | "modified"
export type SortOrder = "asc" | "desc"

interface Prefs {
  theme: ThemeMode
  view: ViewMode
  sortKey: SortKey
  sortOrder: SortOrder
}

const STORAGE_KEY = "ui.prefs"
const defaults: Prefs = { theme: "system", view: "list", sortKey: "name", sortOrder: "asc" }

function load(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
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

export function toggleSort(key: SortKey): void {
  if (prefs.sortKey === key) {
    prefs.sortOrder = prefs.sortOrder === "asc" ? "desc" : "asc"
  } else {
    prefs.sortKey = key
    prefs.sortOrder = "asc"
  }
}
