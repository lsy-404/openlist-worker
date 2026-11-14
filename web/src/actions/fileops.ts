import { api } from "@/api"
import { t } from "@/i18n"
import { passwordFor } from "@/stores/passwords"
import { askConfirm, askFolder, askText } from "@/stores/dialogs"
import { clearSelection } from "@/stores/selection"
import { enqueueUploads } from "@/stores/uploads"
import { collectInput } from "@/utils/dropped"
import { icons } from "@/utils/icons"
import { entryDownloadUrl } from "@/utils/links"
import { joinPath } from "@/utils/path"
import { registerAction } from "./registry"
import type { ActionContext } from "./registry"

const targets = (ctx: ActionContext) => (ctx.surface === "selection" ? ctx.selection : [ctx.entry])
const describe = (ctx: ActionContext) => {
  const list = targets(ctx)
  return list.length === 1 ? t("files.target.one", { name: list[0].name }) : t("files.target.many", { count: list.length })
}

function checkName(name: string): void {
  if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) throw new Error(t("files.errors.invalidName"))
}

/** The backend overwrites silently, so name clashes are caught up front. */
async function assertFree(dir: string, names: string[]): Promise<void> {
  const list = await api.fsList(dir, passwordFor(dir)).catch(() => null)
  const taken = new Set((list?.content ?? []).map((e) => e.name))
  const clash = names.filter((n) => taken.has(n))
  if (clash.length) throw new Error(
      t("files.errors.nameExists", {
        names: clash.slice(0, 5).join(t("files.errors.nameSeparator")),
        more: clash.length > 5 ? t("files.errors.nameMore") : "",
      }),
    )
}

function finish(ctx: ActionContext, changed: boolean, message: string): void {
  if (!changed) return
  clearSelection()
  ctx.refresh()
  ctx.notify(message, "success")
}

function pickFiles(directory: boolean): Promise<FileList | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    if (directory) input.webkitdirectory = true
    else input.multiple = true
    input.addEventListener("change", () => resolve(input.files?.length ? input.files : null))
    input.addEventListener("cancel", () => resolve(null))
    input.click()
  })
}

const inFolderToolbar = (ctx: ActionContext) => ctx.surface === "toolbar" && ctx.kind === "folder"
const onEntries = (ctx: ActionContext) => ctx.surface !== "toolbar"

registerAction({
  id: "upload",
  label: () => t("files.actions.upload"),
  icon: icons.arrowUpload,
  order: 31,
  primary: true,
  when: (ctx) => inFolderToolbar(ctx) && ctx.caps.upload,
  async run(ctx) {
    const files = await pickFiles(false)
    if (files) await enqueueUploads(ctx.dir, collectInput(files))
  },
})

registerAction({
  id: "upload-folder",
  label: () => t("files.actions.uploadFolder"),
  icon: icons.folderArrowUp,
  order: 32,
  when: (ctx) => inFolderToolbar(ctx) && ctx.caps.upload,
  async run(ctx) {
    const files = await pickFiles(true)
    if (files) await enqueueUploads(ctx.dir, collectInput(files))
  },
})

registerAction({
  id: "new-folder",
  label: () => t("files.actions.newFolder"),
  icon: icons.folderAdd,
  order: 30,
  when: (ctx) => inFolderToolbar(ctx) && ctx.caps.mkdir,
  async run(ctx) {
    const changed = await askText({
      title: t("files.dialogs.newFolder.title"),
      label: t("files.dialogs.newFolder.label"),
      value: "",
      confirmLabel: t("files.dialogs.newFolder.confirm"),
      async run(name) {
        checkName(name)
        await assertFree(ctx.dir, [name])
        await api.fsMkdir(joinPath(ctx.dir, name))
      },
    })
    finish(ctx, changed, t("files.notices.folderCreated"))
  },
})

registerAction({
  id: "rename",
  label: () => t("files.actions.rename"),
  icon: icons.rename,
  order: 40,
  when: (ctx) => ctx.surface === "context" && ctx.caps.rename,
  async run(ctx) {
    const changed = await askText({
      title: t("files.dialogs.rename.title"),
      label: t("files.dialogs.rename.label"),
      value: ctx.entry.name,
      selectStem: !ctx.entry.is_dir,
      confirmLabel: t("files.dialogs.rename.confirm"),
      async run(name) {
        checkName(name)
        if (name === ctx.entry.name) return
        await assertFree(ctx.dir, [name])
        await api.fsRename(ctx.path, name)
      },
    })
    finish(ctx, changed, t("files.notices.renamed"))
  },
})

function transfer(id: "move" | "copy", icon: string, order: number) {
  registerAction({
    id,
    label: (ctx) => t(ctx.surface === "selection" ? `files.actions.${id}.label` : `files.actions.${id}.labelTo`),
    icon,
    order,
    when: (ctx) => onEntries(ctx) && ctx.caps[id],
    async run(ctx) {
      const list = targets(ctx)
      const names = list.map((e) => e.name)
      const folders = list.filter((e) => e.is_dir).map((e) => joinPath(ctx.dir, e.name))
      const changed = await askFolder({
        title: t(`files.actions.${id}.title`, { target: describe(ctx) }),
        start: ctx.dir,
        confirmLabel: t(`files.actions.${id}.confirm`),
        blocked(path) {
          if (path === ctx.dir) return t("files.picker.sameFolder")
          if (folders.some((f) => path === f || path.startsWith(f + "/"))) return t("files.picker.insideSelf")
          return null
        },
        async run(dst) {
          await assertFree(dst, names)
          await (id === "move" ? api.fsMove : api.fsCopy)(ctx.dir, dst, names)
        },
      })
      finish(ctx, changed, t(`files.actions.${id}.done`, { target: describe(ctx) }))
    },
  })
}
transfer("move", icons.arrowMove, 50)
transfer("copy", icons.copy, 60)

registerAction({
  id: "delete",
  label: () => t("files.actions.delete"),
  icon: icons.deleteIcon,
  order: 90,
  when: (ctx) => onEntries(ctx) && ctx.caps.remove,
  async run(ctx) {
    const list = targets(ctx)
    const changed = await askConfirm({
      title: t("files.dialogs.delete.title"),
      message: t("files.dialogs.delete.message", { target: describe(ctx) }),
      detail:
        list.length > 1
          ? list.slice(0, 10).map((e) => e.name).concat(list.length > 10 ? [t("files.dialogs.delete.more", { count: list.length })] : [])
          : [],
      confirmLabel: t("files.dialogs.delete.confirm"),
      danger: true,
      async run() {
        await api.fsRemove(ctx.dir, list.map((e) => e.name))
      },
    })
    finish(ctx, changed, t("files.notices.deleted", { target: describe(ctx) }))
  },
})

registerAction({
  id: "download-each",
  label: () => t("files.actions.downloadEach"),
  icon: icons.arrowDownload,
  order: 10,
  when: (ctx) => ctx.surface === "selection" && ctx.selection.some((e) => !e.is_dir),
  async run(ctx) {
    const files = ctx.selection.filter((e) => !e.is_dir)
    const skipped = ctx.selection.length - files.length
    for (const entry of files) {
      const link = document.createElement("a")
      link.href = entryDownloadUrl(joinPath(ctx.dir, entry.name), entry.sign)
      link.download = entry.name
      link.rel = "noopener"
      document.body.appendChild(link)
      link.click()
      link.remove()
      // Browsers drop downloads fired in the same tick
      await new Promise((resolve) => setTimeout(resolve, 350))
    }
    if (skipped) ctx.notify(t("files.notices.skippedFolders", { count: skipped }), "info")
  },
})
