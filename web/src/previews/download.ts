export function startDownload(url: string, name: string): void {
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.rel = "noopener"
  a.click()
}

/** Same-origin proxy variant of a direct download URL, or null when there is none. */
export function proxyUrl(url: string): string | null {
  return /^\/(?:api\/)?d\//.test(url) ? url.replace(/^\/((?:api\/)?)d\//, "/$1p/") : null
}
