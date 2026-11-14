import type { FsEntry } from "@/api"
import { notify } from "@/stores/toast"
import { parentPath } from "@/utils/path"
import { capsFor } from "./permissions"
import type { ActionContext } from "./registry"

interface ContextInit extends Pick<ActionContext, "surface" | "kind" | "path" | "entry" | "downloadUrl"> {
  /** The listing's `write` flag; leave unset where the folder listing is not at hand to hide file operations. */
  writable?: boolean
  selection?: FsEntry[]
}

export function createActionContext(
  { writable, selection = [], ...init }: ContextInit,
  handlers: Pick<ActionContext, "refresh" | "navigate">,
): ActionContext {
  const dir = init.kind === "file" || init.surface === "context" ? parentPath(init.path) : init.path
  return { ...init, dir, selection, caps: capsFor(writable), ...handlers, notify }
}

/** Stand-in entry for the folder a view is showing (the API has no metadata for it in a listing). */
export function folderEntry(name: string): FsEntry {
  return { name, size: 0, is_dir: true, modified: "", sign: "", thumb: "", type: 1 }
}
