import { adminGroups, type AdminPage } from "./types"

const modules = import.meta.glob<{ default: AdminPage }>("./pages/*/index.ts", { eager: true })

export const adminPages: AdminPage[] = Object.values(modules)
  .map((mod) => mod.default)
  .sort((a, b) => adminGroups.indexOf(a.group) - adminGroups.indexOf(b.group) || a.order - b.order)
