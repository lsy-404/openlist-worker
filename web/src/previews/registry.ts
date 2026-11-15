import type { Component } from "vue"
import type { FsFile } from "@/api"
import { t } from "@/i18n"
import { settingFlag, settingJson } from "./settings"
import { isText } from "./kinds"

/** Props every viewer component receives. */
export interface PreviewProps {
  file: FsFile
  /** Path of the file in URL space. */
  path: string
  /** Direct, signed download URL (relative to the site origin). */
  downloadUrl: string
}

export interface Viewer {
  /** Unique; also the i18n key preview.viewers.<key> unless `label` is set. */
  key: string
  label?: string
  match(file: FsFile): boolean
  component: Component
  /** Extra props merged into the component's props. */
  props?: Record<string, unknown>
  /** Lower is listed first; defaults to 100. */
  order?: number
  /** When false the viewer is listed after the download page, like a secondary option. */
  prior?: () => boolean
}

const viewers: Viewer[] = []

export function registerViewer(viewer: Viewer): void {
  const index = viewers.findIndex((v) => v.key === viewer.key)
  if (index >= 0) viewers.splice(index, 1, viewer)
  else viewers.push(viewer)
}

export function viewerLabel(viewer: Viewer): string {
  return viewer.label ?? t(`preview.viewers.${viewer.key}`)
}

const LARGE_TEXT = 1024 * 1024

export type IframeScheme = Record<string, Record<string, string>>

/** Entries of a `{"ext1,ext2": {"label": "url template"}}` setting that apply to the file name. */
export function schemesFor(setting: string, name: string): { label: string; template: string }[] {
  const map = settingJson<IframeScheme>(setting)
  if (!map) return []
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase()
  const out: { label: string; template: string }[] = []
  for (const [exts, entries] of Object.entries(map)) {
    if (!exts.split(",").some((e) => e.trim().toLowerCase() === ext)) continue
    for (const [label, template] of Object.entries(entries ?? {})) if (typeof template === "string") out.push({ label, template })
  }
  return out
}

let iframeViewer: Component | null = null
export function setIframeViewer(component: Component): void {
  iframeViewer = component
}

/** Viewers that accept the file, in display order. The download page is always present. */
export function findViewers(file: FsFile): Viewer[] {
  const byOrder = (a: Viewer, b: Viewer) => (a.order ?? 100) - (b.order ?? 100)
  const matched = viewers.filter((v) => v.key !== "download" && v.match(file)).sort(byOrder)
  const download = viewers.find((v) => v.key === "download")
  const primary = matched.filter((v) => v.prior?.() ?? true)
  const secondary = matched.filter((v) => !(v.prior?.() ?? true))

  const iframes: Viewer[] = iframeViewer
    ? schemesFor("iframe_previews", file.name).map(({ label, template }) => ({
        key: `iframe-${label}`,
        label,
        match: () => true,
        component: iframeViewer!,
        props: { template },
        order: 50,
      }))
    : []

  const downloadFirst = settingFlag("preview_download_by_default")
  const largeText = isText(file) && file.size >= LARGE_TEXT
  const head = downloadFirst ? [] : [...primary, ...iframes]
  const tail = downloadFirst ? [...primary, ...iframes, ...secondary] : secondary

  const list: Viewer[] = []
  if (!download) return [...head, ...tail]
  if (largeText) list.push(download, ...head)
  else if (matched.length === 0 && iframes.length === 0 && file.size < LARGE_TEXT) {
    const text = viewers.filter((v) => v.key === "text" || v.key === "editor").sort(byOrder)
    list.push(download, ...text)
  } else if (downloadFirst) list.push(download)
  else list.push(...head, download)
  return [...list, ...tail]
}
