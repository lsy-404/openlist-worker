import { shallowReactive } from "vue"
import { api, type FsEntry } from "@/api"
import { t } from "@/i18n"
import { passwordFor } from "@/stores/passwords"
import { clearSelection } from "@/stores/selection"
import { notify } from "@/stores/toast"
import { joinPath } from "@/utils/path"

export const clipboard = shallowReactive({ mode: null as "cut" | "copy" | null, dir: "", entries: [] as FsEntry[], busy: false })

export function describeEntries(entries: FsEntry[]): string {
  return entries.length === 1 ? t("files.target.one", { name: entries[0].name }) : t("files.target.many", { count: entries.length })
}

export function stash(mode: "cut" | "copy", dir: string, entries: FsEntry[]): void {
  clipboard.mode = mode
  clipboard.dir = dir
  clipboard.entries = entries
  notify(t(`explorer.clipboard.${mode}`, { target: describeEntries(entries) }), "info")
}

export function isCut(dir: string, name: string): boolean {
  return clipboard.mode === "cut" && clipboard.dir === dir && clipboard.entries.some((e) => e.name === name)
}

/** The backend overwrites silently, so name clashes are caught before the transfer. */
async function assertFree(dst: string, names: string[]): Promise<void> {
  const list = await api.fsList(dst, passwordFor(dst)).catch(() => null)
  const taken = new Set((list?.content ?? []).map((e) => e.name))
  const clash = names.filter((n) => taken.has(n))
  if (!clash.length) return
  throw new Error(
    t("files.errors.nameExists", {
      names: clash.slice(0, 5).join(t("files.errors.nameSeparator")),
      more: clash.length > 5 ? t("files.errors.nameMore") : "",
    }),
  )
}

export async function pasteInto(dst: string, done: () => void): Promise<void> {
  const { mode, dir, entries } = clipboard
  if (!mode || !entries.length || clipboard.busy) return
  if (mode === "cut" && dir === dst) {
    notify(t("explorer.clipboard.sameFolder"), "info")
    return
  }
  clipboard.busy = true
  try {
    const folders = entries.filter((e) => e.is_dir).map((e) => joinPath(dir, e.name))
    if (folders.some((f) => dst === f || dst.startsWith(f + "/"))) throw new Error(t("files.picker.insideSelf"))
    const names = entries.map((e) => e.name)
    await assertFree(dst, names)
    await (mode === "cut" ? api.fsMove : api.fsCopy)(dir, dst, names)
    notify(t(`files.actions.${mode === "cut" ? "move" : "copy"}.done`, { target: describeEntries(entries) }), "success")
    if (mode === "cut") {
      clipboard.mode = null
      clipboard.entries = []
    }
    clearSelection()
    done()
  } catch (err) {
    notify(err instanceof Error ? err.message : String(err), "danger")
  } finally {
    clipboard.busy = false
  }
}
