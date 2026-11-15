import { extension } from "@/utils/format"
import { settingList } from "./settings"

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "ico", "apng", "jfif", "tif", "tiff", "heic", "heif"])
const VIDEO = new Set(["mp4", "webm", "mkv", "mov", "m4v", "ogv", "m3u8", "flv", "m2ts"])
const AUDIO = new Set(["mp3", "flac", "ogg", "oga", "opus", "wav", "m4a", "aac", "weba"])
const MARKDOWN = new Set(["md", "markdown", "mdown"])
const TEXT = new Set([
  "txt", "log", "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "inf", "conf", "cfg", "config", "properties", "env",
  "sh", "bash", "zsh", "bat", "cmd", "ps1", "reg", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "vue", "css", "scss", "less",
  "csv", "tsv", "xml", "html", "htm", "xhtml", "svg", "plist", "csproj", "sql", "c", "h", "cpp", "hpp", "cc", "cs", "java", "kt",
  "go", "rs", "rb", "php", "lua", "pl", "swift", "dart", "diff", "patch", "gitignore", "dockerfile", "makefile", "url", "lrc", "srt", "vtt", "ass", "nfo",
])
const ARCHIVE = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "tbz2", "xz", "txz"])

type Named = { name: string; type: number }

const inSetting = (key: string, f: Named) => settingList(key).has(extension(f.name))
// Source-code extensions stay text even when a site setting also lists them as media (for example ts)
const isSource = (f: Named) => TEXT.has(extension(f.name)) && !IMAGE.has(extension(f.name))

// Backend file types: 2 video, 3 audio, 4 text, 5 image
export const isImage = (f: Named) =>
  IMAGE.has(extension(f.name)) || ((f.type === 5 || inSetting("image_types", f)) && !isSource(f))
export const isVideo = (f: Named) => VIDEO.has(extension(f.name)) || ((f.type === 2 || inSetting("video_types", f)) && !isSource(f))
export const isAudio = (f: Named) => AUDIO.has(extension(f.name)) || ((f.type === 3 || inSetting("audio_types", f)) && !isSource(f))
export const isMarkdown = (f: { name: string }) => MARKDOWN.has(extension(f.name))
export const isPdf = (f: { name: string }) => extension(f.name) === "pdf"
export const isHtml = (f: { name: string }) => ["html", "htm", "xhtml"].includes(extension(f.name))
export const isUrlFile = (f: { name: string }) => extension(f.name) === "url"
export const isPlist = (f: { name: string }) => extension(f.name) === "plist"
export const isIpa = (f: { name: string }) => ["ipa", "tipa"].includes(extension(f.name))
export const isDocx = (f: { name: string }) => extension(f.name) === "docx"
export const isXlsx = (f: { name: string }) => ["xlsx", "xlsm"].includes(extension(f.name))
export const isPptx = (f: { name: string }) => extension(f.name) === "pptx"
export const isCast = (f: { name: string }) => extension(f.name) === "cast"
export const isTorrent = (f: { name: string }) => extension(f.name) === "torrent"
export const isArchive = (f: { name: string }) => ARCHIVE.has(extension(f.name))
export const isSubtitle = (f: { name: string }) => ["srt", "vtt", "ass", "ssa"].includes(extension(f.name))
export const isLyrics = (f: { name: string }) => extension(f.name) === "lrc"
export const isText = (f: Named) => {
  const ext = extension(f.name)
  const name = f.name.toLowerCase()
  return (
    TEXT.has(ext) ||
    inSetting("text_types", f) ||
    (!IMAGE.has(ext) && !isVideo(f) && !isAudio(f) && f.type === 4) ||
    (!ext && (TEXT.has(name) || settingList("text_types").has(name)))
  )
}

/** File name without its final extension. */
export const stem = (name: string) => name.replace(/\.[^./]+$/, "")
