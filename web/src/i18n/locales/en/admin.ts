import type zh from "../zh-CN/admin"

const messages: typeof zh = {
  title: "Admin console",
  back: "Back to files",
  groups: { content: "Content", access: "Access", system: "System" },
  denied: { title: "No permission", detail: "This area is for administrators only. Sign in with an administrator account to continue." },
  table: { empty: "Nothing here yet", error: "Couldn't load", actions: "Actions" },
  panel: { save: "Save" },
  confirmDelete: { title: "Confirm delete", message: "Delete \"{name}\"? This can't be undone." },
  actions: { create: "New", refresh: "Refresh", edit: "Edit", delete: "Delete" },
  notices: { saved: "Saved", deleted: "Deleted" },
}
export default messages
