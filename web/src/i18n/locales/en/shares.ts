import type zh from "../zh-CN/shares"

const messages: typeof zh = {
  title: "Shares",
  actions: {
    share: "Share",
    copyLink: "Copy link",
    open: "Open",
    enable: "Enable",
    disable: "Disable",
    edit: "Edit",
    delete: "Delete",
    refresh: "Refresh",
  },
  columns: { files: "Path", creator: "Creator", expires: "Expires", accessed: "Accesses", status: "Status" },
  status: { active: "Active", disabled: "Disabled", expired: "Expired", exhausted: "Used up", password: "Password" },
  never: "Never",
  empty: "No shares yet",
  dialog: {
    create: "Share {target}",
    edit: "Edit share",
    password: "Password",
    expires: "Expires",
    maxAccessed: "Max accesses",
    unlimited: "Unlimited",
    id: "Custom ID",
    idAuto: "Generated",
    link: "Share link",
    copy: "Copy",
    done: "Done",
    submit: "Create",
  },
  link: {
    notFound: "This share does not exist, or has no such location",
    disabled: "This share has been disabled",
    expired: "This share has expired",
    exhausted: "This share has reached its access limit",
    empty: "This share is empty",
  },
}

export default messages
