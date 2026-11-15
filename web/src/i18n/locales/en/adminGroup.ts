import type zh from "../zh-CN/adminGroup"

const messages: typeof zh = {
  title: "Groups",
  description:
    "Grant general users access by directory. A general user can only reach the directories granted by their groups, and one without groups cannot access anything.",
  columns: { name: "Name", description: "Description", scopes: "Directories", members: "Members" },
  empty: "No groups yet",
  emptyDetail: "General users can only browse files after they are added to a group with access.",
  panel: { create: "New group", edit: "Edit group" },
  sections: { scopes: "Directories" },
  fields: { name: "Name", nameRequired: "Enter a name", description: "Description" },
  presets: { read: "Read only", write: "Read and write", custom: "Custom" },
  scopes: {
    help: "Each row grants access to that directory and everything below it. When a user is in several groups, permissions are combined.",
    empty: "No directories granted",
    path: "Directory path",
    pathHelp: "For example /public.",
    permission: "Permission",
    showBits: "Show all permissions",
    hideBits: "Hide permissions",
    add: "Add directory",
    remove: "Remove",
  },
}

export default messages
