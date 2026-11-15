export interface Setting {
  key: string
  value: string
  type: string
  options?: string
  help?: string
  group: number
  /** 0 public, 1 read-only, 2 private, 3 deprecated */
  flag: number
}

export interface SettingsSectionDef {
  id: string
  /** Backend group id; sections map to exactly one group, which enables reset to defaults. */
  group: number
  labelKey: string
  items: Setting[]
}

export const GROUP_LABELS: Record<number, string> = {
  1: "site",
  2: "appearance",
  3: "preview",
  4: "global",
  7: "sso",
  8: "ldap",
  10: "traffic",
  12: "media",
  14: "other",
}

export const GROUP_ORDER = [1, 7, 8, 4, 3, 2, 10, 12, 14]

/** Groups whose defaults hold credentials or tokens that a bulk reset must not wipe. */
export const NO_RESET_GROUPS = new Set([14])

/** Settings the new interface never reads; kept editable under a collapsed section. */
export const UNUSED_KEYS = new Set([
  "announcement",
  "main_color",
  "home_icon",
  "home_container",
  "settings_layout",
  "customize_head",
  "customize_body",
  "pagination_type",
  "code_editor_theme",
  "audio_cover",
  "audio_autoplay",
  "video_autoplay",
  "readme_autorender",
  "markdown_autorender",
  "filter_readme_scripts",
  "external_previews",
  "iframe_previews",
  "office_preview",
  "pdf_preview",
  "force_preview",
  "specify_preview",
  "preview_archives_by_default",
])

export const TOKEN_KEY = "token"

export function humanize(key: string): string {
  const words = key.replace(/_/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function isSecretKey(key: string): boolean {
  return /(secret|token|_key)$/.test(key)
}
