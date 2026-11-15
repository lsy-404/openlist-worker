import { reactive } from "vue"
import { api, ApiError, type FsEntry } from "@/api"
import { passwordFor } from "@/stores/passwords"
import { joinPath, splitPath } from "@/utils/path"

export interface TreeNode {
  dirs: string[] | null
  loading: boolean
  error: "failed" | "locked" | null
  open: boolean
}

export const tree = reactive(new Map<string, TreeNode>())

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" })

export function nodeFor(path: string): TreeNode {
  let node = tree.get(path)
  if (!node) {
    node = { dirs: null, loading: false, error: null, open: false }
    tree.set(path, node)
  }
  return tree.get(path)!
}

function setDirs(path: string, names: string[]): void {
  const node = nodeFor(path)
  node.dirs = [...names].sort(collator.compare)
  node.error = null
}

export async function loadChildren(path: string): Promise<void> {
  const node = nodeFor(path)
  if (node.dirs || node.loading) return
  node.loading = true
  try {
    const list = await api.fsDirs(path, passwordFor(path))
    setDirs(path, (list ?? []).map((d) => d.name))
  } catch (err) {
    node.error = err instanceof ApiError && err.kind === "forbidden" ? "locked" : "failed"
  } finally {
    node.loading = false
  }
}

export function toggleNode(path: string): void {
  const node = nodeFor(path)
  node.open = !node.open
  if (node.open) void loadChildren(path)
}

/** Opens the chain of folders down to `path` so the current location is visible in the tree. */
export async function revealPath(path: string): Promise<void> {
  const parts = splitPath(path)
  let current = "/"
  nodeFor(current).open = true
  await loadChildren(current)
  for (const part of parts) {
    current = joinPath(current, part)
    nodeFor(current).open = true
    await loadChildren(current)
    if (nodeFor(current).error) return
  }
}

/** Keeps the tree in step with a listing that was just fetched for the folder on screen. */
export function syncFolder(path: string, entries: FsEntry[]): void {
  setDirs(path, entries.filter((e) => e.is_dir).map((e) => e.name))
}

export function resetTree(): void {
  tree.clear()
}
