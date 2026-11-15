import { defineAdminPage } from "@/admin/types"
import { icons } from "@/utils/icons"

export default defineAdminPage({
  path: "settings",
  title: "adminSettings.title",
  icon: icons.settings,
  group: "system",
  order: 10,
  component: () => import("./SettingsPage.vue"),
})
