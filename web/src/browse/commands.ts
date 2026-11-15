import { computed, type Ref } from "vue"
import { useRouter } from "vue-router"
import { actionLabel, actionsFor, type Action, type ActionContext } from "@/actions"
import { createActionContext, folderEntry } from "@/actions/context"
import type { FsList } from "@/api"
import { t } from "@/i18n"
import { clearSelection, selectAll, selection } from "@/stores/selection"
import { browseIcons, icons } from "@/utils/icons"
import { entryDownloadUrl } from "@/utils/links"
import { encodePath, joinPath, splitPath } from "@/utils/path"
import { clipboard, pasteInto, stash } from "./clipboard"

export interface Command {
  id: string
  label: string
  icon: string
  disabled: boolean
  run(): void
}

/** Command-bar commands for the folder on screen, built on the shared action registry and the selection store. */
export function useCommands(path: Ref<string>, list: Ref<FsList | null>, reload: () => void) {
  const router = useRouter()
  const handlers = { refresh: reload, navigate: (p: string) => void router.push(encodePath(p)) }

  const entries = computed(() => list.value?.content ?? [])
  const picked = computed(() => entries.value.filter((e) => selection.names.has(e.name)))

  const folderCtx = computed<ActionContext | null>(() =>
    list.value
      ? createActionContext(
          {
            surface: "toolbar",
            kind: "folder",
            path: path.value,
            entry: folderEntry(splitPath(path.value).pop() ?? ""),
            downloadUrl: null,
            writable: list.value.write,
          },
          handlers,
        )
      : null,
  )

  // One entry acts through its own menu context (rename, download), several through the bulk one
  const selectionCtx = computed<ActionContext | null>(() => {
    const current = list.value
    const items = picked.value
    if (!current || !items.length) return null
    if (items.length === 1) {
      const [entry] = items
      const target = joinPath(path.value, entry.name)
      return createActionContext(
        {
          surface: "context",
          kind: entry.is_dir ? "folder" : "file",
          path: target,
          entry,
          downloadUrl: entry.is_dir ? null : entryDownloadUrl(target, entry.sign),
          writable: current.write,
        },
        handlers,
      )
    }
    return createActionContext(
      {
        surface: "selection",
        kind: "folder",
        path: path.value,
        entry: folderEntry(splitPath(path.value).pop() ?? ""),
        downloadUrl: null,
        writable: current.write,
        selection: items,
      },
      handlers,
    )
  })

  function find(ctx: ActionContext | null, ...ids: string[]): Action | undefined {
    return ctx ? actionsFor(ctx).find((a) => ids.includes(a.id)) : undefined
  }

  function viaAction(id: string, label: string, icon: string, ctx: ActionContext | null, ...ids: string[]): Command {
    const action = find(ctx, ...ids)
    return {
      id,
      label: action && ctx ? actionLabel(action, ctx) : label,
      icon: action?.icon ?? icon,
      disabled: !action,
      run: () => void (action && ctx && action.run(ctx)),
    }
  }

  const commands = computed(() => {
    const folder = folderCtx.value
    const sel = selectionCtx.value
    const caps = folder?.caps
    const some = picked.value.length > 0
    const make = (id: string, label: string, icon: string, disabled: boolean, run: () => void): Command => ({ id, label, icon, disabled, run })
    const pasteCap = clipboard.mode === "cut" ? caps?.move : caps?.copy

    return {
      newItems: ["new-folder", "upload", "upload-folder"].flatMap((id) => (find(folder, id) ? [viaAction(id, id, icons.add, folder, id)] : [])),
      cut: caps?.move ? make("cut", t("explorer.command.cut"), browseIcons.cut, !some, () => stash("cut", path.value, picked.value)) : null,
      copy: caps?.copy ? make("copy", t("explorer.command.copy"), icons.copy, !some, () => stash("copy", path.value, picked.value)) : null,
      paste:
        caps?.move || caps?.copy
          ? make("paste", t("explorer.command.paste"), browseIcons.clipboardPaste, !clipboard.mode || !pasteCap || clipboard.busy, () => void pasteInto(path.value, reload))
          : null,
      rename: caps?.rename ? viaAction("rename", t("files.actions.rename"), icons.rename, sel, "rename") : null,
      remove: caps?.remove ? viaAction("delete", t("files.actions.delete"), icons.deleteIcon, sel, "delete") : null,
      download: folder ? viaAction("download", t("files.actions.download"), icons.arrowDownload, sel, "download", "download-each") : null,
      moveTo: caps?.move ? viaAction("move", t("files.actions.move.labelTo"), icons.arrowMove, sel, "move") : null,
      copyTo: caps?.copy ? viaAction("copy-to", t("files.actions.copy.labelTo"), icons.copy, sel, "copy") : null,
      copyLink: folder ? viaAction("copy-link", t("files.actions.copyLink"), icons.link, sel ?? folder, "copy-link") : null,
      selectAll: make("select-all", t("explorer.command.selectAll"), icons.selectAllOn, !entries.value.length, () => selectAll(entries.value.map((e) => e.name))),
      selectNone: make("select-none", t("explorer.command.selectNone"), icons.dismiss, !some, clearSelection),
    }
  })

  return { commands, picked, entries }
}

export type Commands = ReturnType<typeof useCommands>["commands"]["value"]
