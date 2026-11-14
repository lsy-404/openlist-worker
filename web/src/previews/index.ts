import { registerPreview } from "./registry"
import { isAudio, isImage, isMarkdown, isPdf, isText, isVideo } from "./kinds"
import AudioPreview from "./AudioPreview.vue"
import ImagePreview from "./ImagePreview.vue"
import PdfPreview from "./PdfPreview.vue"
import TextPreview from "./TextPreview.vue"
import VideoPreview from "./VideoPreview.vue"

registerPreview({ name: "image", match: isImage, component: ImagePreview, order: 10 })
registerPreview({ name: "video", match: isVideo, component: VideoPreview, order: 10 })
registerPreview({ name: "audio", match: isAudio, component: AudioPreview, order: 10 })
registerPreview({ name: "pdf", match: isPdf, component: PdfPreview, order: 10 })
registerPreview({ name: "text", match: (f) => isMarkdown(f) || isText(f), component: TextPreview, order: 20 })

export { findPreview, registerPreview } from "./registry"
export type { Preview, PreviewProps } from "./registry"
