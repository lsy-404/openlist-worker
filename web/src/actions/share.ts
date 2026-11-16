import { t } from "@/i18n"
import { askShare } from "@/shares/dialog"
import { icons } from "@/utils/icons"
import { isSharePath, joinPath } from "@/utils/path"
import { canShare } from "./permissions"
import { registerAction } from "./registry"

registerAction({
  id: "share",
  label: () => t("shares.actions.share"),
  icon: icons.share,
  order: 25,
  when: (ctx) => canShare() && !isSharePath(ctx.path),
  async run(ctx) {
    const files = ctx.surface === "selection" ? ctx.selection.map((e) => joinPath(ctx.dir, e.name)) : [ctx.path]
    await askShare({ kind: "create", files })
  },
})
