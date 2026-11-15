export interface LyricLine {
  time: number
  text: string
}

const STAMP = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g

/** Lines of an LRC file in time order; a line with several timestamps repeats for each. */
export function parseLyrics(source: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of source.replace(/\r/g, "").split("\n")) {
    const stamps = [...raw.matchAll(STAMP)]
    if (!stamps.length) continue
    const text = raw.replace(STAMP, "").trim()
    for (const [, min, sec, frac = "0"] of stamps) {
      lines.push({ time: Number(min) * 60 + Number(sec) + Number(`0.${frac}`), text })
    }
  }
  return lines.sort((a, b) => a.time - b.time)
}
