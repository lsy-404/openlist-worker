import { extension } from "@/utils/format"

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg", "bmp", "ico", "apng", "jfif", "tif", "tiff"])
const VIDEO = new Set(["mp4", "webm", "mkv", "mov", "m4v", "ogv", "m3u8"])
const AUDIO = new Set(["mp3", "flac", "ogg", "oga", "opus", "wav", "m4a", "aac", "weba"])
const MARKDOWN = new Set(["md", "markdown", "mdown"])
const TEXT = new Set([
  "txt", "log", "json", "jsonc", "json5", "yaml", "yml", "toml", "ini", "inf", "conf", "cfg", "config", "properties", "env",
  "sh", "bash", "zsh", "bat", "cmd", "ps1", "reg", "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "vue", "css", "scss", "less",
  "csv", "tsv", "xml", "html", "htm", "xhtml", "svg", "plist", "csproj", "sql", "c", "h", "cpp", "hpp", "cc", "cs", "java", "kt",
  "go", "rs", "rb", "php", "lua", "pl", "swift", "dart", "diff", "patch", "gitignore", "dockerfile", "makefile", "url", "lrc", "srt", "vtt", "ass", "nfo",
])

// Backend file types: 2 video, 3 audio, 4 text, 5 image
export const isImage = (f: { name: string; type: number }) => IMAGE.has(extension(f.name)) || (f.type === 5 && !extension(f.name))
export const isVideo = (f: { name: string; type: number }) => VIDEO.has(extension(f.name)) || f.type === 2
export const isAudio = (f: { name: string; type: number }) => AUDIO.has(extension(f.name)) || f.type === 3
export const isMarkdown = (f: { name: string }) => MARKDOWN.has(extension(f.name))
export const isPdf = (f: { name: string }) => extension(f.name) === "pdf"
export const isText = (f: { name: string; type: number }) => {
  const ext = extension(f.name)
  return TEXT.has(ext) || (!IMAGE.has(ext) && !isVideo(f) && !isAudio(f) && f.type === 4) || (!ext && TEXT.has(f.name.toLowerCase()))
}

