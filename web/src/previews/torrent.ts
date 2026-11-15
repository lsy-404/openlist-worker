import bencode from "bencode"

export interface TorrentFile {
  path: string
  size: number
}

export interface TorrentInfo {
  name: string
  comment: string
  createdBy: string
  created: number | null
  size: number
  files: TorrentFile[]
  trackers: string[]
  infoHash: string
  magnet: string
}

const decoder = new TextDecoder()
const text = (value: unknown): string => (value instanceof Uint8Array ? decoder.decode(value) : typeof value === "string" ? value : "")
const num = (value: unknown): number => (typeof value === "number" ? value : typeof value === "bigint" ? Number(value) : 0)

async function sha1Hex(data: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", data as BufferSource))
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("")
}

export async function parseTorrent(buffer: ArrayBuffer): Promise<TorrentInfo> {
  const root = bencode.decode(new Uint8Array(buffer) as never) as Record<string, unknown>
  const info = root.info as Record<string, unknown> | undefined
  if (!info || typeof info !== "object") throw new Error("not a torrent")

  const name = text(info["name.utf-8"] ?? info.name)
  const entries = Array.isArray(info.files) ? (info.files as Record<string, unknown>[]) : null
  const files: TorrentFile[] = entries
    ? entries.map((f) => ({
        path: ((f["path.utf-8"] ?? f.path) as unknown[]).map(text).join("/"),
        size: num(f.length),
      }))
    : [{ path: name, size: num(info.length) }]

  const trackers = new Set<string>()
  if (root.announce) trackers.add(text(root.announce))
  for (const tier of (root["announce-list"] as unknown[][] | undefined) ?? []) for (const url of tier) trackers.add(text(url))
  trackers.delete("")

  const infoHash = await sha1Hex(bencode.encode(info))
  const magnet =
    `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}` + [...trackers].map((tr) => `&tr=${encodeURIComponent(tr)}`).join("")

  return {
    name,
    comment: text(root.comment),
    createdBy: text(root["created by"]),
    created: root["creation date"] ? num(root["creation date"]) * 1000 : null,
    size: files.reduce((sum, f) => sum + f.size, 0),
    files,
    trackers: [...trackers],
    infoHash,
    magnet,
  }
}
