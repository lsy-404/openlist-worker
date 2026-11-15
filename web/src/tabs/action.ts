import { registerAction } from "@/actions/registry"
import { t } from "@/i18n"
import { encodePath } from "@/utils/path"
import { tabIcons } from "./icons"
import { openTab } from "./store"

registerAction({
  id: "open-in-new-tab",
  label: () => t("tabs.openInNewTab"),
  icon: tabIcons.open,
  order: 15,
  when: (ctx) => ctx.surface === "context",
  run: (ctx) => openTab(encodePath(ctx.path), false),
})
