import type { FsEntry } from "@/api"
import { notify } from "@/stores/toast"
import type { ActionContext } from "./registry"

export function createActionContext(
  init: Pick<ActionContext, "surface" | "kind" | "path" | "entry" | "downloadUrl">,
  handlers: Pick<ActionContext, "refresh" | "navigate">,
): ActionContext {
  return { ...init, ...handlers, notify }
}

/** Stand-in entry for the folder a view is showing (the API has no metadata for it in a listing). */
export function folderEntry(name: string): FsEntry {
  return { name, size: 0, is_dir: true, modified: "", sign: "", thumb: "", type: 1 }
}
