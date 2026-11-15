import { Compartment, EditorState, type Extension } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { StreamLanguage, type StreamParser } from "@codemirror/language"
import { oneDark } from "@codemirror/theme-one-dark"
import { basicSetup } from "codemirror"
import { extension } from "@/utils/format"

const stream = <T>(parser: StreamParser<T>) => StreamLanguage.define(parser)

const languages: Record<string, () => Promise<Extension>> = {
  javascript: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true }),
  json: async () => (await import("@codemirror/lang-json")).json(),
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),
  html: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  xml: async () => (await import("@codemirror/lang-xml")).xml(),
  yaml: async () => (await import("@codemirror/lang-yaml")).yaml(),
  python: async () => (await import("@codemirror/lang-python")).python(),
  sql: async () => (await import("@codemirror/lang-sql")).sql(),
  java: async () => (await import("@codemirror/lang-java")).java(),
  cpp: async () => (await import("@codemirror/lang-cpp")).cpp(),
  go: async () => (await import("@codemirror/lang-go")).go(),
  rust: async () => (await import("@codemirror/lang-rust")).rust(),
  php: async () => (await import("@codemirror/lang-php")).php(),
  shell: async () => stream((await import("@codemirror/legacy-modes/mode/shell")).shell),
  toml: async () => stream((await import("@codemirror/legacy-modes/mode/toml")).toml),
  properties: async () => stream((await import("@codemirror/legacy-modes/mode/properties")).properties),
  powershell: async () => stream((await import("@codemirror/legacy-modes/mode/powershell")).powerShell),
  ruby: async () => stream((await import("@codemirror/legacy-modes/mode/ruby")).ruby),
  swift: async () => stream((await import("@codemirror/legacy-modes/mode/swift")).swift),
  kotlin: async () => stream((await import("@codemirror/legacy-modes/mode/clike")).kotlin),
  csharp: async () => stream((await import("@codemirror/legacy-modes/mode/clike")).csharp),
  diff: async () => stream((await import("@codemirror/legacy-modes/mode/diff")).diff),
}

const byExtension: Record<string, string> = {
  js: "javascript", mjs: "javascript", cjs: "javascript", jsx: "javascript", ts: "javascript", tsx: "javascript",
  json: "json", jsonc: "json", json5: "json", md: "markdown", markdown: "markdown", mdown: "markdown",
  html: "html", htm: "html", xhtml: "html", vue: "html", css: "css", scss: "css", less: "css",
  xml: "xml", plist: "xml", csproj: "xml", svg: "xml", config: "xml", yaml: "yaml", yml: "yaml",
  py: "python", sql: "sql", java: "java", c: "cpp", h: "cpp", cpp: "cpp", hpp: "cpp", cc: "cpp", cs: "csharp",
  go: "go", rs: "rust", php: "php", sh: "shell", bash: "shell", zsh: "shell", toml: "toml",
  ini: "properties", inf: "properties", conf: "properties", cfg: "properties", properties: "properties", env: "properties",
  ps1: "powershell", rb: "ruby", swift: "swift", kt: "kotlin", diff: "diff", patch: "diff",
}

export interface EditorHandle {
  getText(): string
  setText(text: string): void
  setWrap(wrap: boolean): void
  setReadOnly(readOnly: boolean): void
  setDark(dark: boolean): void
  focus(): void
  destroy(): void
}

export interface EditorOptions {
  parent: HTMLElement
  doc: string
  name: string
  readOnly: boolean
  wrap: boolean
  dark: boolean
  onChange(): void
  onSave(): void
}

const frame = EditorView.theme({
  "&": { height: "100%", fontSize: "13px", backgroundColor: "var(--fluent-control-alt)", color: "var(--fluent-text)" },
  ".cm-scroller": { fontFamily: '"Cascadia Mono", Consolas, ui-monospace, monospace', lineHeight: "1.6" },
  ".cm-gutters": { backgroundColor: "var(--fluent-surface)", color: "var(--fluent-muted)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in srgb, var(--fluent-text) 6%, transparent)" },
  "&.cm-focused": { outline: "2px solid var(--fluent-accent, #0f6cbd)", outlineOffset: "-2px" },
})

export async function createEditor(options: EditorOptions): Promise<EditorHandle> {
  const language = new Compartment()
  const wrapping = new Compartment()
  const readOnly = new Compartment()
  const theme = new Compartment()
  const key = byExtension[extension(options.name)] ?? (options.name.toLowerCase() === "dockerfile" ? "shell" : undefined)
  const lang = key ? await languages[key]!().catch(() => []) : []

  const view = new EditorView({
    parent: options.parent,
    state: EditorState.create({
      doc: options.doc,
      extensions: [
        basicSetup,
        keymap.of([
          indentWithTab,
          { key: "Mod-s", preventDefault: true, run: () => (options.onSave(), true) },
        ]),
        frame,
        language.of(lang),
        wrapping.of(options.wrap ? EditorView.lineWrapping : []),
        readOnly.of(EditorState.readOnly.of(options.readOnly)),
        theme.of(options.dark ? oneDark : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) options.onChange()
        }),
      ],
    }),
  })

  return {
    getText: () => view.state.doc.toString(),
    setText: (text) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } }),
    setWrap: (wrap) => view.dispatch({ effects: wrapping.reconfigure(wrap ? EditorView.lineWrapping : []) }),
    setReadOnly: (value) => view.dispatch({ effects: readOnly.reconfigure(EditorState.readOnly.of(value)) }),
    setDark: (dark) => view.dispatch({ effects: theme.reconfigure(dark ? oneDark : []) }),
    focus: () => view.focus(),
    destroy: () => view.destroy(),
  }
}
