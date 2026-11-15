import { defineAdminPage } from "@/admin/types"
import { systemIcons } from "@/utils/icons"

export default defineAdminPage({
  path: "overview",
  title: "adminOverview.title",
  icon: systemIcons.board,
  group: "home",
  order: 0,
  component: () => import("./OverviewPage.vue"),
})
