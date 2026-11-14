import { watch } from "vue"
import { createI18n, type LocaleMessageDictionary, type VueMessageType } from "vue-i18n"
import { prefs } from "@/stores/prefs"
import { localeOptions, type Locale } from "./locales"

// Every locales/<locale>/<namespace>.ts default export becomes messages[locale][namespace]
const modules = import.meta.glob<{ default: Record<string, unknown> }>("./locales/*/*.ts", { eager: true })

type MessageSchema = Record<string, LocaleMessageDictionary<VueMessageType>>

const messages = {} as Record<Locale, MessageSchema>
for (const [file, mod] of Object.entries(modules)) {
  const match = /^\.\/locales\/([^/]+)\/([^/]+)\.ts$/.exec(file)
  if (match) (messages[match[1] as Locale] ??= {})[match[2]] = mod.default as LocaleMessageDictionary<VueMessageType>
}

for (const { value } of localeOptions) {
  if (!messages[value]) throw new Error(`missing messages for locale ${value}`)
}

export const i18n = createI18n<[MessageSchema], Locale, false>({
  legacy: false,
  locale: prefs.locale,
  fallbackLocale: "zh-CN" satisfies Locale,
  messages,
})

export const t = i18n.global.t

export function bindLocale(): void {
  watch(
    () => prefs.locale,
    (locale) => {
      i18n.global.locale.value = locale
      document.documentElement.lang = locale
    },
    { immediate: true },
  )
}
