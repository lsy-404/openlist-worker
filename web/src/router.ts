import { createRouter, createWebHistory } from "vue-router"
import { adminRoute } from "@/admin/routes"
import BrowseView from "@/views/BrowseView.vue"
import LoginView from "@/views/LoginView.vue"

export const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    { path: "/@login", component: LoginView },
    adminRoute,
    { path: "/:pathMatch(.*)*", component: BrowseView },
  ],
  scrollBehavior: (to, from, saved) => saved ?? (to.path === from.path ? false : { top: 0 }),
})
