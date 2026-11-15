import { defineAdminPage } from "@/admin/types"
import { syncIcon } from "./icons"

export default defineAdminPage({
  path: "sync",
  title: "adminSync.title",
  icon: syncIcon,
  group: "content",
  order: 30,
  component: () => import("./SyncPage.vue"),
})
