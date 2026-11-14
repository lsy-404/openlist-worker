import { shallowReactive } from "vue"
import type { FsEntry } from "@/api"

export interface ActionContext {
  /** Where the action is being rendered: the view toolbar or an entry's menu. */
  surface: "toolbar" | "context"
  kind: "file" | "folder"
  /** Path of the target in URL space (not including the user's base path). */
  path: string
  entry: FsEntry
  /** Direct download link for files, relative or absolute; null for folders. */
  downloadUrl: string | null
  notify(text: string, tone?: "info" | "success" | "danger"): void
  /** Reload the current view's data. */
  refresh(): void
  navigate(path: string): void
}

export interface Action {
  id: string
  label: string | ((ctx: ActionContext) => string)
  /** SVG string, e.g. from `icons` in utils/icons.ts. */
  icon: string
  /** Lower comes first; defaults to 100. */
  order?: number
  /** Primary actions render as accent buttons in toolbars. */
  primary?: boolean
  when?(ctx: ActionContext): boolean
  run(ctx: ActionContext): void | Promise<void>
}

const actions = shallowReactive(new Map<string, Action>())

export function registerAction(action: Action): void {
  actions.set(action.id, action)
}

export function unregisterAction(id: string): void {
  actions.delete(id)
}

export function actionsFor(ctx: ActionContext): Action[] {
  return [...actions.values()]
    .filter((a) => a.when?.(ctx) ?? true)
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
}

export function actionLabel(action: Action, ctx: ActionContext): string {
  return typeof action.label === "function" ? action.label(ctx) : action.label
}
