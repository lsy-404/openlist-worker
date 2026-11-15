import { createRouter, createWebHistory } from "vue-router"
import { adminRoute } from "@/admin/routes"
import BrowseSidebar from "@/browse/BrowseSidebar.vue"
import BrowseView from "@/views/BrowseView.vue"
import { installTabs } from "@/tabs/store"
import LoginView from "@/views/LoginView.vue"

export const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    { path: "/@login", component: LoginView },
    { path: "/@tasks", component: () => import("@/tasks/TasksView.vue") },
    adminRoute,
    { path: "/:pathMatch(.*)*", components: { default: BrowseView, sidebar: BrowseSidebar } },
  ],
})

installTabs(router)
