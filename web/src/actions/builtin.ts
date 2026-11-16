import { t } from "@/i18n"
import { icons } from "@/utils/icons"
import { absoluteUrl } from "@/utils/path"
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
  when: (ctx) => ctx.kind === "file" && !!ctx.downloadUrl,
  run(ctx) {
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
