import { t } from "@/i18n"
import { extension } from "@/utils/format"

export function entryExtension(entry: { name: string; is_dir: boolean }): string {
  return entry.is_dir ? "" : extension(entry.name)
}

export function entryTypeLabel(entry: { name: string; is_dir: boolean }): string {
  if (entry.is_dir) return t("explorer.type.folder")
  const ext = extension(entry.name)
  return ext ? t("explorer.type.file", { ext: ext.toUpperCase() }) : t("explorer.type.plain")
}
