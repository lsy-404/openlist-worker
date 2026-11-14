import type zh from "../zh-CN/adminMeta"

const messages: typeof zh = {
  title: "Metas",
  description: "Set passwords, hide rules, readme text and write access per path.",
  columns: { path: "Path", password: "Password", write: "Write", hide: "Hide rules" },
  yes: "Yes",
  no: "No",
  empty: "No metas yet",
  emptyDetail: "Create a meta for a path to protect it with a password or hide files.",
  panel: { create: "New meta", edit: "Edit meta" },
  fields: {
    path: "Path",
    pathHelp: "For example /movies. Must be a folder path.",
    pathRequired: "Enter a path",
    password: "Access password",
    passwordHelp: "Leave empty for no password.",
    write: "Allow write",
    hide: "Hide rules",
    hideHelp: "One regular expression per line. Matching file names are hidden.",
    readme: "Readme",
    readmeHelp: "Markdown, shown below the folder listing.",
    applyToSub: "Also apply to subfolders",
  },
}
export default messages
