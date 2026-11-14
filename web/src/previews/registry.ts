import { shallowReactive } from "vue"
import type { Component } from "vue"
import type { FsFile } from "@/api"

/** Props every preview component receives. */
export interface PreviewProps {
  file: FsFile
  /** Path of the file in URL space. */
  path: string
  /** Direct, signed download URL (relative to the site origin). */
  downloadUrl: string
}

export interface Preview {
  name: string
  match(file: FsFile): boolean
  component: Component
  /** Lower is checked first; defaults to 100. */
  order?: number
}

const previews = shallowReactive<Preview[]>([])

export function registerPreview(preview: Preview): void {
  const index = previews.findIndex((p) => p.name === preview.name)
  if (index >= 0) previews.splice(index, 1, preview)
  else previews.push(preview)
}

/** First registered preview whose `match` accepts the file, or null. */
export function findPreview(file: FsFile): Preview | null {
  return [...previews].sort((a, b) => (a.order ?? 100) - (b.order ?? 100)).find((p) => p.match(file)) ?? null
}
