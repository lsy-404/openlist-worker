import { t } from "@/i18n"
import { startPackage } from "@/stores/packages"
import { icons } from "@/utils/icons"
import { absoluteUrl, splitPath } from "@/utils/path"
import { pageUrl } from "@/utils/links"
import { registerAction } from "./registry"

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context; fall back to a transient textarea
    const area = document.createElement("textarea")
    area.value = text
    area.style.position = "fixed"
    area.style.opacity = "0"
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  }
}

registerAction({
  id: "download",
  label: () => t("files.actions.download"),
  icon: icons.arrowDownload,
  order: 10,
  primary: true,
  when: (ctx) => (ctx.kind === "file" ? !!ctx.downloadUrl : ctx.surface !== "toolbar"),
  run(ctx) {
    if (ctx.kind === "folder") {
      const picked = ctx.surface === "selection"
      const name = (picked ? splitPath(ctx.dir).pop() : ctx.entry.name) || t("files.package.defaultName")
      startPackage(ctx.dir, picked ? ctx.selection : [ctx.entry], name).catch((err) => ctx.notify(err instanceof Error ? err.message : String(err), "danger"))
      return
    }
    const link = document.createElement("a")
    link.href = ctx.downloadUrl!
    link.download = ctx.entry.name
    link.rel = "noopener"
    document.body.appendChild(link)
    link.click()
    link.remove()
  },
})

registerAction({
  id: "copy-link",
  label: () => t("files.actions.copyLink"),
  icon: icons.link,
  order: 20,
  when: (ctx) => ctx.surface !== "selection",
  async run(ctx) {
    const url = ctx.kind === "file" && ctx.downloadUrl ? absoluteUrl(ctx.downloadUrl) : pageUrl(ctx.path)
    ctx.notify((await copyText(url)) ? t("files.notices.linkCopied") : t("files.notices.copyFailed"), "info")
  },
})
