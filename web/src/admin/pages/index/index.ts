import { defineAdminPage } from "@/admin/types"
import { systemIcons } from "@/utils/icons"

export default defineAdminPage({
  path: "index",
  title: "adminIndex.title",
  icon: systemIcons.search,
  group: "system",
  order: 20,
  component: () => import("./IndexPage.vue"),
})
