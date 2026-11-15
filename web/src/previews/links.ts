import { absoluteUrl, joinPath } from "@/utils/path"
import { entryDownloadUrl } from "@/utils/links"

export interface LinkSource {
  /** Direct link of the file, possibly relative. */
  downloadUrl: string
  name: string
}

/**
 * Expands an external-viewer URL template: $name, $url (file link), $durl (site download link), each
 * optionally with e (URL-encode) and b (base64) modifiers such as $e_url or $eb_durl.
 */
export function expandTemplate(template: string, source: LinkSource): string {
  const link = absoluteUrl(source.downloadUrl)
  const apply = (value: string, ops: string[]) => {
    let out = value
    for (const op of [...ops].reverse()) out = op === "e" ? encodeURIComponent(out) : op === "b" ? btoa(out) : out
    return out
  }
  return template
    .replace(/\$[eb_]*durl/g, (m) => apply(link, m.match(/[eb]/g) ?? []))
    .replace(/\$[eb_]*url/g, (m) => apply(link, m.match(/[eb]/g) ?? []))
    .replace(/\$name/g, source.name)
}

/** Only web links may be opened from file content. */
export function isWebUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value)
    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

/** Download URL of another file in a folder, from its listing entry. */
export function entryUrl(dir: string, entry: { name: string; sign: string }): string {
  return entryDownloadUrl(joinPath(dir, entry.name), entry.sign)
}
