import type { RouteRecordRaw } from "vue-router"
import { isAdmin } from "@/stores/session"
import { adminPages } from "./registry"

export const adminRoute: RouteRecordRaw = {
  path: "/@manage",
  components: {
    default: () => import("./AdminShell.vue"),
    sidebar: () => import("./AdminNav.vue"),
  },
  meta: { showSidebar: () => isAdmin.value },
  children: [
    { path: "", redirect: `/@manage/${adminPages[0].path}` },
    ...adminPages.map((page) => ({ path: page.path, component: page.component, meta: { title: page.title } })),
  ],
}
