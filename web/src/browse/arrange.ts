import type { FsEntry } from "@/api"
import { i18n, t } from "@/i18n"
import type { Arrange, GroupKey } from "@/stores/prefs"
import { entryExtension, entryTypeLabel } from "./entryType"

export interface Group<T extends FsEntry = FsEntry> {
  id: string
  label: string
  entries: T[]
}

const DAY = 86_400_000
const KB = 1024
const SIZE_LIMITS = [0, 16 * KB, KB ** 2, 128 * KB ** 2, KB ** 3, 4 * KB ** 3]
const SIZE_BUCKETS = ["empty", "tiny", "small", "medium", "large", "huge", "gigantic"]
const DATE_BUCKETS = ["longAgo", "earlierThisYear", "lastMonth", "earlierThisMonth", "lastWeek", "earlierThisWeek", "yesterday", "today"]

const collators = new Map<string, Intl.Collator>()

function collator(): Intl.Collator {
  const locale = i18n.global.locale.value
  let value = collators.get(locale)
  if (!value) {
    value = new Intl.Collator(locale, { numeric: true, sensitivity: "base" })
    collators.set(locale, value)
  }
  return value
}

/** Folders first, then by the chosen column; ties fall back to the name. */
export function sortEntries<T extends FsEntry>(entries: readonly T[], { sortKey, sortOrder }: Arrange): T[] {
  const dir = sortOrder === "asc" ? 1 : -1
  const names = collator()
  return [...entries].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    if (sortKey === "name") return names.compare(a.name, b.name) * dir
    let diff = 0
    if (sortKey === "type") diff = names.compare(entryExtension(a), entryExtension(b))
    else if (sortKey === "size") diff = a.size - b.size
    else diff = Date.parse(a.modified) - Date.parse(b.modified)
    return diff && !Number.isNaN(diff) ? Math.sign(diff) * dir : names.compare(a.name, b.name)
  })
}

function dateBucket(modified: string, now: Date): number {
  const time = Date.parse(modified)
  if (Number.isNaN(time)) return 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = today - ((now.getDay() + 6) % 7) * DAY
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime()
  const yearStart = new Date(now.getFullYear(), 0, 1).getTime()
  if (time >= today) return 7
  if (time >= today - DAY) return 6
  if (time >= weekStart) return 5
  if (time >= weekStart - 7 * DAY) return 4
  if (time >= monthStart) return 3
  if (time >= lastMonthStart) return 2
  return time >= yearStart ? 1 : 0
}

// First Han character of each pinyin initial in collation order; no syllable starts with I, U or V.
const PINYIN_BOUNDS = "阿八嚓哒妸发旮哈讥咔垃痳拏噢妑七呥扨它穵夕丫帀"
const PINYIN_LETTERS = "ABCDEFGHJKLMNOPQRSTWXYZ"
const pinyin = new Intl.Collator("zh-CN-u-co-pinyin")

function pinyinInitial(char: string): string {
  for (let i = PINYIN_BOUNDS.length - 1; i >= 0; i--) {
    if (pinyin.compare(char, PINYIN_BOUNDS[i]) >= 0) return PINYIN_LETTERS[i]
  }
  return ""
}

/** Bucket of an entry: a rank that orders the groups and an id that names them. */
function bucket(entry: FsEntry, key: Exclude<GroupKey, "none">, now: Date): { rank: number; id: string; label: string } {
  if (key === "name") {
    const first = entry.name.charAt(0).toUpperCase()
    if (/[0-9]/.test(first)) return { rank: 0, id: "0-9", label: "0 – 9" }
    const letter = /\p{Script=Han}/u.test(first) ? pinyinInitial(first) : first
    if (/[A-Z]/.test(letter)) return { rank: letter.charCodeAt(0) - 64, id: letter, label: letter }
    return { rank: 27, id: "other", label: t("explorer.group.other") }
  }
  if (key === "modified") {
    const rank = dateBucket(entry.modified, now)
    return { rank, id: DATE_BUCKETS[rank], label: t(`explorer.group.date.${DATE_BUCKETS[rank]}`) }
  }
  if (key === "size") {
    if (entry.is_dir) return { rank: -1, id: "folders", label: t("explorer.group.size.folders") }
    const rank = SIZE_LIMITS.findIndex((limit) => entry.size <= limit)
    const index = rank < 0 ? SIZE_LIMITS.length : rank
    return { rank: index, id: SIZE_BUCKETS[index], label: t(`explorer.group.size.${SIZE_BUCKETS[index]}`) }
  }
  const label = entryTypeLabel(entry)
  return { rank: entry.is_dir ? -1 : 0, id: label, label }
}

/** Splits already sorted entries into groups; each group keeps the incoming order. */
export function groupEntries<T extends FsEntry>(entries: readonly T[], { groupKey, groupOrder }: Arrange, now = new Date()): Group<T>[] {
  if (groupKey === "none") return [{ id: "", label: "", entries: [...entries] }]
  const groups = new Map<string, Group<T> & { rank: number }>()
  for (const entry of entries) {
    const { rank, id, label } = bucket(entry, groupKey, now)
    let group = groups.get(id)
    if (!group) groups.set(id, (group = { id, label, rank, entries: [] }))
    group.entries.push(entry)
  }
  const names = collator()
  const dir = groupOrder === "asc" ? 1 : -1
  return [...groups.values()].sort((a, b) => (a.rank - b.rank || (groupKey === "type" ? names.compare(a.label, b.label) : 0)) * dir)
}
