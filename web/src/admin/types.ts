import type { Component } from "vue"

export const adminGroups = ["home", "content", "access", "system"] as const
export type AdminGroup = (typeof adminGroups)[number]

/** Default export of web/src/admin/pages/<name>/index.ts. */
export interface AdminPage {
  /** Route segment under /@manage, e.g. "meta". */
  path: string
  /** i18n key of the nav label and page title. */
  title: string
  /** Raw SVG markup, from `icons`. */
  icon: string
  group: AdminGroup
  /** Sort position inside the group, ascending. */
  order: number
  component: () => Promise<{ default: Component }>
}

export function defineAdminPage(page: AdminPage): AdminPage {
  return page
}

declare module "vue-router" {
  interface RouteMeta {
    /** i18n key used as the default admin page title. */
    title?: string
    /** When present and false the app frame hides the sidebar pane. */
    showSidebar?: () => boolean
  }
}
