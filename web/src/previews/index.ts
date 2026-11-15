import type { Component } from "vue"
import { defineAsyncComponent } from "vue"
import type { FsFile } from "@/api"
import {
  isArchive, isAudio, isCast, isDocx, isHtml, isImage, isIpa, isMarkdown, isPdf, isPlist, isPptx, isText, isTorrent, isUrlFile,
  isVideo, isXlsx,
} from "./kinds"
import PreviewHost from "./PreviewHost.vue"
import { registerViewer, setIframeViewer } from "./registry"
import { settingFlag } from "./settings"

const lazy = (loader: () => Promise<{ default: Component }>) => defineAsyncComponent(loader)

registerViewer({ key: "image", match: isImage, component: lazy(() => import("./ImagePreview.vue")), order: 10 })
registerViewer({ key: "video", match: isVideo, component: lazy(() => import("./VideoPreview.vue")), order: 10 })
registerViewer({ key: "video360", match: isVideo, component: lazy(() => import("./Video360Preview.vue")), order: 20 })
registerViewer({ key: "audio", match: isAudio, component: lazy(() => import("./AudioPreview.vue")), order: 10 })
registerViewer({ key: "pdf", match: isPdf, component: lazy(() => import("./PdfPreview.vue")), order: 10 })
registerViewer({ key: "docx", match: isDocx, component: lazy(() => import("./DocxPreview.vue")), order: 10 })
registerViewer({ key: "xlsx", match: isXlsx, component: lazy(() => import("./XlsxPreview.vue")), order: 10 })
registerViewer({ key: "pptx", match: isPptx, component: lazy(() => import("./PptxPreview.vue")), order: 10 })
registerViewer({ key: "html", match: isHtml, component: lazy(() => import("./HtmlPreview.vue")), order: 10 })
registerViewer({ key: "url", match: isUrlFile, component: lazy(() => import("./UrlPreview.vue")), order: 10 })
registerViewer({ key: "plist", match: isPlist, component: lazy(() => import("./InstallPreview.vue")), props: { kind: "plist" }, order: 10 })
registerViewer({ key: "ipa", match: isIpa, component: lazy(() => import("./InstallPreview.vue")), props: { kind: "ipa" }, order: 10 })
registerViewer({ key: "cast", match: isCast, component: lazy(() => import("./CastPreview.vue")), order: 10 })
registerViewer({ key: "torrent", match: isTorrent, component: lazy(() => import("./TorrentPreview.vue")), order: 10 })
registerViewer({
  key: "archive",
  match: isArchive,
  component: lazy(() => import("./ArchivePreview.vue")),
  order: 10,
  prior: () => settingFlag("preview_archives_by_default") && !settingFlag("preview_download_by_default"),
})
registerViewer({
  key: "markdown",
  match: isMarkdown,
  component: lazy(() => import("./TextPreview.vue")),
  props: { startMode: "rendered" },
  order: 10,
})
registerViewer({
  key: "text",
  match: (f) => isMarkdown(f) || isText(f),
  component: lazy(() => import("./TextPreview.vue")),
  props: { startMode: "source" },
  order: 20,
})
registerViewer({
  key: "editor",
  match: (f) => isMarkdown(f) || isText(f),
  component: lazy(() => import("./EditorPreview.vue")),
  order: 30,
})
registerViewer({ key: "download", match: () => true, component: lazy(() => import("./DownloadPreview.vue")), order: 900 })
setIframeViewer(lazy(() => import("./IframePreview.vue")))

/** The preview component for a file: a host that lists every matching viewer and switches between them. */
export function findPreview(_file: FsFile): { name: string; component: Component } {
  return { name: "host", component: PreviewHost }
}

export { findViewers, registerViewer } from "./registry"
export type { PreviewProps, Viewer } from "./registry"
