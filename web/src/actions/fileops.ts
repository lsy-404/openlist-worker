import { api } from "@/api"
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
  return list.length === 1 ? `“${list[0].name}”` : `${list.length} 项`
}

function checkName(name: string): void {
  if (name === "." || name === ".." || name.includes("/") || name.includes("\\")) throw new Error("名称不能是 . 或 ..，也不能包含 / 或 \\")
}

/** The backend overwrites silently, so name clashes are caught up front. */
async function assertFree(dir: string, names: string[]): Promise<void> {
  const list = await api.fsList(dir, passwordFor(dir)).catch(() => null)
  const taken = new Set((list?.content ?? []).map((e) => e.name))
  const clash = names.filter((n) => taken.has(n))
  if (clash.length) throw new Error(`目标位置已存在同名项目：${clash.slice(0, 5).join("、")}${clash.length > 5 ? " 等" : ""}`)
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
  label: "上传文件",
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
  label: "上传文件夹",
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
  label: "新建文件夹",
  icon: icons.folderAdd,
  order: 30,
  when: (ctx) => inFolderToolbar(ctx) && ctx.caps.mkdir,
  async run(ctx) {
    const changed = await askText({
      title: "新建文件夹",
      label: "文件夹名称",
      value: "",
      confirmLabel: "创建",
      async run(name) {
        checkName(name)
        await assertFree(ctx.dir, [name])
        await api.fsMkdir(joinPath(ctx.dir, name))
      },
    })
    finish(ctx, changed, "文件夹已创建")
  },
})

registerAction({
  id: "rename",
  label: "重命名",
  icon: icons.rename,
  order: 40,
  when: (ctx) => ctx.surface === "context" && ctx.caps.rename,
  async run(ctx) {
    const changed = await askText({
      title: "重命名",
      label: "新名称",
      value: ctx.entry.name,
      selectStem: !ctx.entry.is_dir,
      confirmLabel: "重命名",
      async run(name) {
        checkName(name)
        if (name === ctx.entry.name) return
        await assertFree(ctx.dir, [name])
        await api.fsRename(ctx.path, name)
      },
    })
    finish(ctx, changed, "已重命名")
  },
})

function transfer(id: "move" | "copy", label: string, past: string, icon: string, order: number) {
  registerAction({
    id,
    label: (ctx) => (ctx.surface === "selection" ? label : `${label}到…`),
    icon,
    order,
    when: (ctx) => onEntries(ctx) && ctx.caps[id],
    async run(ctx) {
      const list = targets(ctx)
      const names = list.map((e) => e.name)
      const folders = list.filter((e) => e.is_dir).map((e) => joinPath(ctx.dir, e.name))
      const changed = await askFolder({
        title: `${label} ${describe(ctx)} 到`,
        start: ctx.dir,
        confirmLabel: `${label}到此处`,
        blocked(path) {
          if (path === ctx.dir) return "目标不能是当前文件夹"
          if (folders.some((f) => path === f || path.startsWith(f + "/"))) return "不能选择被操作的文件夹或其子文件夹"
          return null
        },
        async run(dst) {
          await assertFree(dst, names)
          await (id === "move" ? api.fsMove : api.fsCopy)(ctx.dir, dst, names)
        },
      })
      finish(ctx, changed, `已${past} ${describe(ctx)}`)
    },
  })
}
transfer("move", "移动", "移动", icons.arrowMove, 50)
transfer("copy", "复制", "复制", icons.copy, 60)

registerAction({
  id: "delete",
  label: "删除",
  icon: icons.deleteIcon,
  order: 90,
  when: (ctx) => onEntries(ctx) && ctx.caps.remove,
  async run(ctx) {
    const list = targets(ctx)
    const changed = await askConfirm({
      title: "删除",
      message: `确定删除 ${describe(ctx)}吗？此操作无法撤销。`,
      detail: list.length > 1 ? list.slice(0, 10).map((e) => e.name).concat(list.length > 10 ? [`…共 ${list.length} 项`] : []) : [],
      confirmLabel: "删除",
      danger: true,
      async run() {
        await api.fsRemove(ctx.dir, list.map((e) => e.name))
      },
    })
    finish(ctx, changed, `已删除 ${describe(ctx)}`)
  },
})

registerAction({
  id: "download-each",
  label: "逐个下载",
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
    if (skipped) ctx.notify(`已跳过 ${skipped} 个文件夹`, "info")
  },
})
