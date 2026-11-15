import { computed, reactive, ref, watch } from "vue"
import { i18n, t } from "@/i18n"
import { splitPath } from "@/utils/path"
import { dismissTask, runningCount, tasks, type Task, type TaskKind, type TaskState } from "./store"

export interface TaskCard {
  id: string
  kind: TaskKind
  state: TaskState
  interrupted: boolean
  /** File or folder name, or an item count for batches. */
  what: string
  /** Localised name of the destination folder, empty when the kind has none. */
  dest: string
  /** Source and destination paths shown under the title. */
  route: string
  folder: string
  tasks: Task[]
  loaded: number
  size: number
  /** Tasks that reached a final state. */
  done: number
  failed: number
  startedAt: number
  endedAt: number
  error: string
  /** Fraction between 0 and 1, or -1 when the progress is unknown. */
  fraction: number
  cancel?: () => void
  retry?: () => void
}

const isPending = (state: TaskState) => state === "queued" || state === "running"

function folderName(path: string): string {
  return splitPath(path).pop() ?? t("tasks.card.root")
}

function aggregate(list: Task[]): TaskState {
  const pending = list.filter((task) => isPending(task.state))
  if (pending.length) return pending.some((task) => task.state === "running") || pending.length < list.length ? "running" : "queued"
  if (list.some((task) => task.state === "failed")) return "failed"
  if (list.some((task) => task.state === "cancelled")) return "cancelled"
  return "succeeded"
}

function buildCard(list: Task[]): TaskCard {
  const first = list[0]
  const state = aggregate(list)
  const size = list.reduce((sum, task) => sum + task.size, 0)
  const loaded = list.reduce((sum, task) => sum + (task.state === "succeeded" ? task.size : task.loaded), 0)
  const done = list.filter((task) => !isPending(task.state)).length
  const failedTasks = list.filter((task) => task.state === "failed")
  const cancels = list.filter((task) => task.cancel)
  const retries = list.filter((task) => task.retry)
  const upload = first.kind === "upload"
  const source = upload ? t("tasks.card.thisDevice") : first.source
  const target = upload ? first.folder : first.target
  const fraction = size > 0 ? Math.min(1, loaded / size) : upload ? done / list.length : state === "succeeded" ? 1 : -1
  return {
    id: first.batch !== undefined && upload ? `batch${first.batch}` : first.id,
    kind: first.kind,
    state,
    interrupted: list.every((task) => task.interrupted),
    what: list.length === 1 ? first.title : t("tasks.items", { count: list.length }),
    dest: first.kind === "delete" || first.kind === "mkdir" ? "" : first.kind === "rename" ? target : folderName(target),
    route: [source, target].filter(Boolean).join("  →  "),
    folder: first.folder,
    tasks: list,
    loaded,
    size,
    done,
    failed: failedTasks.length,
    startedAt: Math.min(...list.map((task) => task.startedAt || Number.MAX_SAFE_INTEGER)) % Number.MAX_SAFE_INTEGER,
    endedAt: list.some((task) => isPending(task.state)) ? 0 : Math.max(...list.map((task) => task.endedAt)),
    error: failedTasks[0]?.error ?? "",
    fraction,
    cancel: cancels.length ? () => cancels.forEach((task) => task.cancel?.()) : undefined,
    retry: retries.length ? () => retries.forEach((task) => task.retry?.()) : undefined,
  }
}

export const cards = computed<TaskCard[]>(() => {
  const groups = new Map<string, Task[]>()
  for (const task of tasks.value) {
    const key = task.kind === "upload" && task.batch !== undefined ? `batch${task.batch}` : task.id
    const group = groups.get(key)
    if (group) group.push(task)
    else groups.set(key, [task])
  }
  return [...groups.values()].map(buildCard)
})

export const isCardPending = (card: TaskCard) => isPending(card.state)

export function dismissCard(card: TaskCard): void {
  card.tasks.forEach((task) => dismissTask(task.id))
}

/** Overall progress of everything running, as shown on the header button. */
export const overall = computed(() => {
  const sized = cards.value.filter((card) => isPending(card.state) && card.size > 0)
  const size = sized.reduce((sum, card) => sum + card.size, 0)
  if (!size) return { indeterminate: runningCount.value > 0, percent: 0 }
  return { indeterminate: false, percent: Math.round((sized.reduce((sum, card) => sum + card.loaded, 0) / size) * 100) }
})

export const hasFailed = computed(() => cards.value.some((card) => card.state === "failed"))

const SAMPLE_WINDOW = 5
const HISTORY_LENGTH = 60

interface Metrics {
  /** Bytes per second averaged over the last few samples. */
  speed: number
  history: number[]
}

export const clock = ref(Date.now())
export const metrics = reactive<Record<string, Metrics>>({})
const samples = new Map<string, { at: number; loaded: number }[]>()

function sample(): void {
  const now = Date.now()
  clock.value = now
  const live = new Set<string>()
  for (const card of cards.value) {
    if (card.state !== "running" || card.size <= 0) continue
    live.add(card.id)
    const list = samples.get(card.id) ?? []
    list.push({ at: now, loaded: card.loaded })
    if (list.length > SAMPLE_WINDOW) list.shift()
    samples.set(card.id, list)
    const head = list[0]
    const span = (now - head.at) / 1000
    const speed = span > 0 ? Math.max(0, (card.loaded - head.loaded) / span) : 0
    const entry = (metrics[card.id] ??= { speed: 0, history: [] })
    entry.speed = speed
    entry.history = [...entry.history, speed].slice(-HISTORY_LENGTH)
  }
  for (const id of [...samples.keys()]) {
    if (live.has(id)) continue
    samples.delete(id)
    delete metrics[id]
  }
}

let timer = 0
watch(
  () => runningCount.value > 0,
  (active) => {
    clearInterval(timer)
    if (active) {
      sample()
      timer = window.setInterval(sample, 1000)
    } else {
      sample()
    }
  },
  { immediate: true },
)

export function formatDuration(ms: number): string {
  const locale = i18n.global.locale.value
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts: [number, string][] = hours ? [[hours, "hour"], [minutes, "minute"]] : minutes ? [[minutes, "minute"], [seconds, "second"]] : [[seconds, "second"]]
  return parts.map(([value, unit]) => new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "narrow" }).format(value)).join(" ")
}
