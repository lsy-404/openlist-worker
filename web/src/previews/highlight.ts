import type { HLJSApi, LanguageFn } from "highlight.js"
import { extension } from "@/utils/format"

type Loader = () => Promise<{ default: LanguageFn }>

const languages: Record<string, Loader> = {
  bash: () => import("highlight.js/lib/languages/bash"),
  c: () => import("highlight.js/lib/languages/c"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  css: () => import("highlight.js/lib/languages/css"),
  diff: () => import("highlight.js/lib/languages/diff"),
  dos: () => import("highlight.js/lib/languages/dos"),
  go: () => import("highlight.js/lib/languages/go"),
  ini: () => import("highlight.js/lib/languages/ini"),
  java: () => import("highlight.js/lib/languages/java"),
  javascript: () => import("highlight.js/lib/languages/javascript"),
  json: () => import("highlight.js/lib/languages/json"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  php: () => import("highlight.js/lib/languages/php"),
  powershell: () => import("highlight.js/lib/languages/powershell"),
  python: () => import("highlight.js/lib/languages/python"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  rust: () => import("highlight.js/lib/languages/rust"),
  scss: () => import("highlight.js/lib/languages/scss"),
  sql: () => import("highlight.js/lib/languages/sql"),
  swift: () => import("highlight.js/lib/languages/swift"),
  typescript: () => import("highlight.js/lib/languages/typescript"),
  xml: () => import("highlight.js/lib/languages/xml"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
}

const byExtension: Record<string, string> = {
  sh: "bash", bash: "bash", zsh: "bash", c: "c", h: "c", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp",
  css: "css", less: "scss", scss: "scss", diff: "diff", patch: "diff", bat: "dos", cmd: "dos", go: "go",
  ini: "ini", inf: "ini", conf: "ini", cfg: "ini", config: "xml", properties: "ini", reg: "ini", toml: "ini", url: "ini", env: "ini",
  java: "java", js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript",
  json: "json", jsonc: "json", json5: "json", kt: "kotlin", md: "markdown", markdown: "markdown",
  php: "php", ps1: "powershell", py: "python", rb: "ruby", rs: "rust", sql: "sql", swift: "swift",
  ts: "typescript", tsx: "typescript", xml: "xml", html: "xml", htm: "xml", xhtml: "xml", plist: "xml", csproj: "xml", vue: "xml",
  yaml: "yaml", yml: "yaml",
}

const MAX_HIGHLIGHT = 300_000

export function languageFor(name: string): string | null {
  return byExtension[extension(name)] ?? null
}

let core: Promise<HLJSApi> | null = null
const registered = new Set<string>()

export async function highlightCode(text: string, language: string): Promise<string | null> {
  if (text.length > MAX_HIGHLIGHT || !languages[language]) return null
  core ??= import("highlight.js/lib/core").then((m) => m.default)
  const hljs = await core
  if (!registered.has(language)) {
    hljs.registerLanguage(language, (await languages[language]()).default)
    registered.add(language)
  }
  return hljs.highlight(text, { language, ignoreIllegals: true }).value
}
