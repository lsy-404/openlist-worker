import type zh from "../zh-CN/explorer"

const messages: typeof zh = {
  sidebar: {
    label: "File navigation",
    home: "Home",
    locations: "Locations",
    expand: "Expand {name}",
    collapse: "Collapse {name}",
    loading: "Loading…",
    noFolders: "No subfolders",
    loadFailed: "Couldn't load",
    locked: "Password required",
  },
  nav: {
    back: "Back",
    forward: "Forward",
    up: "Up",
    refresh: "Refresh",
    editAddress: "Edit path",
    address: "Address",
    addressHint: "Press Enter to go, Esc to cancel",
    hiddenPath: "More path segments",
  },
  command: {
    label: "Commands",
    new: "New",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    more: "More",
    sort: "Sort",
    layout: "Layout",
    ascending: "Ascending",
    descending: "Descending",
    selectAll: "Select all",
    selectNone: "Select none",
  },
  layout: {
    details: "Details",
    grid: "Grid",
  },
  columns: {
    name: "Name",
    modified: "Date modified",
    type: "Type",
    size: "Size",
  },
  type: {
    folder: "File folder",
    file: "{ext} file",
    plain: "File",
  },
  status: {
    items: "{count} item | {count} items",
    selected: "{count} selected",
  },
  clipboard: {
    cut: "Cut {target}. Paste it in the destination folder.",
    copy: "Copied {target}. Paste it in the destination folder.",
    sameFolder: "The items are already in this folder",
  },
}

export default messages
