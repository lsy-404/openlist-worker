import { computed, reactive, ref, watch } from "vue"
import { api } from "@/api"
import { t } from "@/i18n"
import { cancelPackage, clearFinishedPackages, packages, type PackageItem } from "@/stores/packages"
import { cancelUpload, clearFinished as clearUploads, retryUpload, uploads, type UploadItem } from "@/stores/uploads"
import { joinPath } from "@/utils/path"

export type TaskKind = "upload" | "package" | "copy" | "move" | "delete" | "rename" | "mkdir"
export type TaskState = "queued" | "running" | "succeeded" | "failed" | "cancelled"

export interface Task {
  id: string
  kind: TaskKind
  /** File or folder name, or a count for batches. */
  title: string
  source: string
  target: string
  /** Folder worth opening once the task is done. */
  folder: string
  state: TaskState
  /** Bytes transferred; only meaningful when `size` is above zero. */
  loaded: number
  size: number
  startedAt: number
  endedAt: number
  error: string
  /** Set when the page was reloaded while the task was still pending. */
  interrupted: boolean
  /** Uploads queued together share a batch. */
  batch?: number
  cancel?: () => void
  retry?: () => void
}

export type OpSpec =
  | { kind: "copy" | "move"; dir: string; dst: string; names: string[] }
  | { kind: "delete"; dir: string; names: string[] }
  | { kind: "rename"; dir: string; names: [string]; newName: string }
  | { kind: "mkdir"; dir: string; names: [string] }

interface OpTask {
  id: string
  spec: OpSpec
  state: "running" | "succeeded" | "failed"
  startedAt: number
  endedAt: number
  error: string
  interrupted: boolean
}

interface ArchivedUpload {
  id: string
  title: string
  target: string
  folder: string
  state: TaskState
  size: number
  loaded: number
  startedAt: number
  endedAt: number
  error: string
  interrupted: boolean
  batch?: number
}

const STORAGE_KEY = "tasks.history"
const MAX_STORED = 200

const ops = reactive<OpTask[]>([])
// Uploads that finished before a reload; their File objects are gone, so they are display-only
const archived = ref<ArchivedUpload[]>([])
let nextOp = 1

const isDone = (state: TaskState) => state === "succeeded" || state === "failed" || state === "cancelled"

function perform(spec: OpSpec): Promise<null> {
  switch (spec.kind) {
    case "copy":
      return api.fsCopy(spec.dir, spec.dst, spec.names)
    case "move":
      return api.fsMove(spec.dir, spec.dst, spec.names)
    case "delete":
      return api.fsRemove(spec.dir, spec.names)
    case "rename":
      return api.fsRename(joinPath(spec.dir, spec.names[0]), spec.newName)
    case "mkdir":
      return api.fsMkdir(joinPath(spec.dir, spec.names[0]))
  }
}

async function execute(task: OpTask): Promise<void> {
  task.state = "running"
  task.error = ""
  task.interrupted = false
  task.startedAt = Date.now()
  task.endedAt = 0
  try {
    await perform(task.spec)
    task.state = "succeeded"
  } catch (err) {
    task.state = "failed"
    task.error = err instanceof Error ? err.message : String(err)
    throw err
  } finally {
    task.endedAt = Date.now()
  }
}

/** Runs a file operation as a tracked task; a failure is recorded and rethrown to the caller. */
export function runOp(spec: OpSpec): Promise<void> {
  const task = reactive<OpTask>({
    id: `op${Date.now().toString(36)}-${nextOp++}`,
    spec,
    state: "running",
    startedAt: 0,
    endedAt: 0,
    error: "",
    interrupted: false,
  })
  ops.push(task)
  return execute(task)
}

function fromOp(op: OpTask): Task {
  const { spec } = op
  const first = spec.names[0]
  const transfer = spec.kind === "copy" || spec.kind === "move"
  return {
    id: op.id,
    kind: spec.kind,
    title: spec.names.length === 1 ? first : t("tasks.items", { count: spec.names.length }),
    source: spec.kind === "mkdir" ? "" : spec.kind === "rename" ? joinPath(spec.dir, first) : spec.dir,
    target: transfer ? spec.dst : spec.kind === "rename" ? spec.newName : spec.kind === "mkdir" ? joinPath(spec.dir, first) : "",
    folder: transfer ? spec.dst : spec.kind === "mkdir" ? joinPath(spec.dir, first) : spec.dir,
    state: op.state,
    loaded: 0,
    size: 0,
    startedAt: op.startedAt,
    endedAt: op.endedAt,
    error: op.error,
    interrupted: op.interrupted,
    retry: op.state === "failed" ? () => void execute(op).catch(() => undefined) : undefined,
  }
}

const UPLOAD_STATE: Record<UploadItem["status"], TaskState> = {
  queued: "queued",
  uploading: "running",
  done: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
}

function fromUpload(item: UploadItem): Task {
  const state = UPLOAD_STATE[item.status]
  return {
    id: `up${item.id}`,
    kind: "upload",
    title: item.name,
    source: "",
    target: item.path,
    folder: item.dir,
    state,
    loaded: item.loaded,
    size: item.size,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    error: item.error,
    interrupted: false,
    batch: item.batch,
    cancel: state === "queued" || state === "running" ? () => cancelUpload(item) : undefined,
    retry: state === "failed" || state === "cancelled" ? () => retryUpload(item) : undefined,
  }
}

const PACKAGE_STATE: Record<PackageItem["status"], TaskState> = {
  running: "running",
  done: "succeeded",
  failed: "failed",
  cancelled: "cancelled",
}

function fromPackage(item: PackageItem): Task {
  const state = PACKAGE_STATE[item.status]
  return {
    id: `pk${item.id}`,
    kind: "package",
    title: item.name,
    source: state === "running" ? item.current : "",
    target: "",
    folder: item.dir,
    state,
    loaded: item.loaded,
    size: item.size,
    startedAt: item.startedAt,
    endedAt: item.endedAt,
    error: item.error,
    interrupted: false,
    cancel: state === "running" ? () => cancelPackage(item) : undefined,
  }
}

function fromArchived(entry: ArchivedUpload): Task {
  return { ...entry, kind: "upload", source: "" }
}

export const tasks = computed<Task[]>(() =>
  [...ops.map(fromOp), ...uploads.items.map(fromUpload), ...packages.items.map(fromPackage), ...archived.value.map(fromArchived)].sort((a, b) => b.startedAt - a.startedAt),
)

export const runningCount = computed(
  () => ops.filter((o) => o.state === "running").length + uploads.items.filter((i) => i.status === "queued" || i.status === "uploading").length +
    packages.items.filter((p) => p.status === "running").length,
)

export function dismissTask(id: string): void {
  const opIndex = ops.findIndex((o) => o.id === id)
  if (opIndex >= 0 && ops[opIndex].state !== "running") ops.splice(opIndex, 1)
  archived.value = archived.value.filter((a) => a.id !== id)
  const upload = uploads.items.find((i) => `up${i.id}` === id)
  if (upload && upload.status !== "queued" && upload.status !== "uploading") uploads.items = uploads.items.filter((i) => i !== upload)
  packages.items = packages.items.filter((p) => `pk${p.id}` !== id || p.status === "running")
}

export function clearFinishedTasks(): void {
  for (let i = ops.length - 1; i >= 0; i--) if (ops[i].state !== "running") ops.splice(i, 1)
  archived.value = []
  clearUploads()
  clearFinishedPackages()
}

export function cancelAllTasks(): void {
  for (const item of uploads.items) cancelUpload(item)
  for (const item of packages.items) cancelPackage(item)
}

// Only finished tasks read `loaded`, so a running upload's progress does not rewrite the storage on every tick
function snapshot(): string {
  const list = tasks.value.slice(0, MAX_STORED).map((task) => ({
    ...task,
    cancel: undefined,
    retry: undefined,
    loaded: isDone(task.state) ? task.loaded : 0,
  }))
  return JSON.stringify({ tasks: list, specs: Object.fromEntries(ops.map((o) => [o.id, o.spec])) })
}

function restore(): void {
  let stored: { tasks?: Task[]; specs?: Record<string, OpSpec> }
  try {
    stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {
    return
  }
  for (const task of stored.tasks ?? []) {
    const pending = !isDone(task.state)
    const state: TaskState = pending ? "failed" : task.state
    const common = {
      id: task.id,
      startedAt: task.startedAt,
      endedAt: task.endedAt || Date.now(),
      error: pending ? "" : task.error,
      interrupted: pending,
    }
    const spec = stored.specs?.[task.id]
    if (spec) {
      ops.push({ ...common, spec, state: state === "succeeded" ? "succeeded" : "failed" })
    } else if (task.kind === "upload") {
      archived.value.push({ ...common, title: task.title, target: task.target, folder: task.folder, state, size: task.size, loaded: task.loaded, batch: task.batch })
    }
  }
}

restore()
watch(snapshot, (value) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, value)
  } catch {
    /* storage unavailable */
  }
})
