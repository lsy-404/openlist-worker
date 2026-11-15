import { defineAdminPage } from "@/admin/types"
import { icons } from "@/utils/icons"

export default defineAdminPage({
  path: "meta",
  title: "adminMeta.title",
  icon: icons.tag,
  group: "content",
  order: 20,
  component: () => import("./MetaPage.vue"),
})
