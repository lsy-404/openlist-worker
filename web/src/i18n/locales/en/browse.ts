import type zh from "../zh-CN/browse"

const messages: typeof zh = {
  breadcrumb: {
    label: "Path",
    root: "Root",
  },
  sort: {
    name: "Name",
    size: "Size",
    modified: "Date modified",
  },
  entryList: {
    select: "Select {name}",
    moreFor: "More actions for {name}",
    moreActions: "More actions",
    showMore: "Show more ({count} remaining)",
  },
  selection: {
    label: "Bulk actions",
    clear: "Clear selection",
    count: "{count} selected",
  },
  file: {
    size: "Size",
    modified: "Date modified",
  },
  folder: {
    count: "{count} item | {count} items",
    countFiltered: "{shown} / {count} item | {shown} / {count} items",
    selectAll: "Select all",
    sortBy: "Sort by",
    ascending: "Ascending",
    descending: "Descending",
    toggleToDescending: "Ascending, click to sort descending",
    toggleToAscending: "Descending, click to sort ascending",
    view: "View",
    viewList: "List",
    viewGrid: "Grid",
    refresh: "Refresh",
    dropHint: "Drop here to upload to this folder",
    noUploadPermission: "You don't have permission to upload here",
    dropReadFailed: "Couldn't read the dropped files",
    noMatches: "No matching items",
    noMatchesDetail: "Try another keyword or clear the filter.",
    empty: "This folder is empty",
    emptyDetail: "There are no files here yet.",
  },
  state: {
    notFound: "Can't find this location",
    notFoundDetail: "The path doesn't exist, or it has been moved or deleted.",
    up: "Go up",
    home: "Go to home",
    locked: "This location needs a password",
    lockedDetail: "Enter the password to view its contents.",
    enterPassword: "Enter password",
    noAccess: "Your account has not been granted access to any directory",
    noAccessDetail: "Contact the administrator to be added to a group that can access directories.",
  },
}

export default messages
