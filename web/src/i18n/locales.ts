export const localeOptions = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en", label: "English" },
] as const

export type Locale = (typeof localeOptions)[number]["value"]

export function isLocale(value: unknown): value is Locale {
  return localeOptions.some((option) => option.value === value)
}

export function detectLocale(language: string): Locale {
  return language.toLowerCase().startsWith("zh") ? "zh-CN" : "en"
}
