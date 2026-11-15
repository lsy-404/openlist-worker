import { defineAdminPage } from "@/admin/types"
import { groupIcons } from "@/utils/icons"

export default defineAdminPage({
  path: "group",
  title: "adminGroup.title",
  icon: groupIcons.people,
  group: "access",
  order: 20,
  component: () => import("./GroupPage.vue"),
})
