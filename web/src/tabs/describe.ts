import type { Router } from "vue-router"
import { t } from "@/i18n"
import { extension } from "@/utils/format"
import { iconForEntry, icons } from "@/utils/icons"
import { isSharePath, splitPath } from "@/utils/path"
import { singletonOf } from "./store"

const SINGLETON_ICONS: Record<string, string> = { "/@manage": icons.settings, "/@tasks": icons.textBulletList, "/@shares": icons.share }

export interface TabLook {
  title: string
  icon: string
}

/** Title and icon for a tab location; reads the reactive translator so locale changes apply. */
export function describeLocation(router: Router, location: string): TabLook {
  const resolved = router.resolve(location)
  const kind = singletonOf(location)
  if (kind) {
    const key = resolved.meta.title as string | undefined
    const title = key ? t(key) : kind === "/@manage" ? t("shell.header.admin") : t("tabs.tasks")
    return { title, icon: SINGLETON_ICONS[kind] }
  }
  const parts = splitPath(decodeURIComponent(resolved.path))
  const name = parts.pop()
  if (!name) return { title: t("tabs.home"), icon: icons.home }
  if (isSharePath(resolved.path) && parts.length <= 1) return { title: name, icon: icons.share }
  // Folders and files share the URL space, so a dotted last segment is taken to be a file
  return { title: name, icon: iconForEntry({ name, is_dir: extension(name) === "", type: 0 }) }
}
