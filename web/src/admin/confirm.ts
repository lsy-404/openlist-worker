import { t } from "@/i18n"
import { askConfirm } from "@/stores/dialogs"

/** Shows the shared delete confirmation; resolves true when the delete was attempted (reload the list). */
export function confirmDelete(name: string, remove: () => Promise<unknown>): Promise<boolean> {
  return askConfirm({
    title: t("admin.confirmDelete.title"),
    message: t("admin.confirmDelete.message", { name }),
    confirmLabel: t("common.delete"),
    danger: true,
    async run() {
      await remove()
    },
  })
}
