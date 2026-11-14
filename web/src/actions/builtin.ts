import { icons } from "@/utils/icons"
import { absoluteUrl } from "@/utils/path"
import { pageUrl } from "@/utils/links"
import { registerAction } from "./registry"

async function copyText(text: string): Promise<boolean> {
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
  label: "下载",
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
  label: "复制链接",
  icon: icons.link,
  order: 20,
  async run(ctx) {
    const url = ctx.kind === "file" && ctx.downloadUrl ? absoluteUrl(ctx.downloadUrl) : pageUrl(ctx.path)
    ctx.notify((await copyText(url)) ? "链接已复制" : "复制失败，请手动复制地址栏链接", "info")
  },
})
