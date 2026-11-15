import { defineAdminPage } from "@/admin/types"
import { storageIcon } from "./icons"

export default defineAdminPage({
  path: "storages",
  title: "adminStorage.title",
  icon: storageIcon,
  group: "content",
  order: 10,
  component: () => import("./StoragePage.vue"),
})
