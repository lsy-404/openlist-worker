import { defineAdminPage } from "@/admin/types"
import { icons } from "@/utils/icons"

export default defineAdminPage({
  path: "user",
  title: "adminUser.title",
  icon: icons.person,
  group: "access",
  order: 10,
  component: () => import("./UserPage.vue"),
})
