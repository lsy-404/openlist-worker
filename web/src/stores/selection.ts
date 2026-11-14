import { reactive } from "vue"

export const selection = reactive({ names: new Set<string>() })
let anchor: string | null = null

export function clearSelection(): void {
  selection.names.clear()
  anchor = null
}

export function selectAll(names: string[]): void {
  selection.names = new Set(names)
}

/** Toggle one entry; with `range` everything between the last toggled entry and this one is selected. */
export function toggleSelection(name: string, ordered: string[], range: boolean): void {
  const from = anchor === null ? -1 : ordered.indexOf(anchor)
  if (range && from >= 0) {
    const to = ordered.indexOf(name)
    const [lo, hi] = from < to ? [from, to] : [to, from]
    for (const n of ordered.slice(lo, hi + 1)) selection.names.add(n)
  } else if (selection.names.has(name)) {
    selection.names.delete(name)
  } else {
    selection.names.add(name)
  }
  anchor = name
}
