import { shallowRef } from "vue"

interface Base {
  title: string
  confirmLabel: string
  /** Runs the operation; a thrown error is shown in the dialog, which stays open for another attempt. */
  run(value: string): Promise<void>
  /** Resolves true when an attempt was made, so callers know to reload even after a failure. */
  settle(attempted: boolean): void
}

export type DialogRequest =
  | (Base & { kind: "prompt"; label: string; value: string; selectStem: boolean })
  | (Base & { kind: "confirm"; message: string; detail: string[]; danger: boolean })
  | (Base & { kind: "folder"; start: string; blocked: (path: string) => string | null })
  | { kind: "conflict"; names: string[]; settle(overwrite: boolean | null): void }

export const activeDialog = shallowRef<DialogRequest | null>(null)
const queue: DialogRequest[] = []

function show(request: DialogRequest): void {
  if (activeDialog.value) queue.push(request)
  else activeDialog.value = request
}

export function closeDialog(): void {
  activeDialog.value = queue.shift() ?? null
}

type Distribute<T> = T extends unknown ? Omit<T, "settle" | "kind"> : never

export function askText(
  options: Omit<Distribute<Extract<DialogRequest, { kind: "prompt" }>>, "selectStem"> & { selectStem?: boolean },
): Promise<boolean> {
  return new Promise((settle) => show({ selectStem: false, ...options, kind: "prompt", settle }))
}

export function askConfirm(
  options: Omit<Distribute<Extract<DialogRequest, { kind: "confirm" }>>, "detail" | "danger"> & {
    detail?: string[]
    danger?: boolean
  },
): Promise<boolean> {
  return new Promise((settle) => show({ detail: [], danger: false, ...options, kind: "confirm", settle }))
}

export function askFolder(options: Distribute<Extract<DialogRequest, { kind: "folder" }>>): Promise<boolean> {
  return new Promise((settle) => show({ ...options, kind: "folder", settle }))
}

/** Resolves true to overwrite, false to skip the existing files, null to cancel the upload. */
export function askConflict(names: string[]): Promise<boolean | null> {
  return new Promise((settle) => show({ kind: "conflict", names, settle }))
}
