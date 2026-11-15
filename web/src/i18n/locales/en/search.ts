import type zh from "../zh-CN/search"

const messages: typeof zh = {
  filter: {
    placeholder: "Filter this list",
    label: "Filter this list",
    clear: "Clear filter",
  },
  box: {
    placeholder: "Search files  {key} K",
    toggle: "Search",
    toggleTitle: "Search (Ctrl+K)",
    field: "Search files",
    close: "Close search",
  },
  dialog: {
    label: "Search",
    title: "Search “{query}”",
    scopeLabel: "Search scope",
    scopeFolder: "This folder",
    scopeSite: "Entire site",
    searching: "Searching",
    searchingHint: "Searching. This may take a while for large folders.",
    unavailable: "Search is unavailable",
    failed: "Search failed",
    noResults: "No matches found",
    noResultsFolder: "No names in this folder or its subfolders match.",
    noResultsSite: "No names on the site match.",
    searchSite: "Search entire site",
    count: "{count} results",
    folder: "Folder",
    loadMore: "Load more ({count} remaining)",
  },
}

export default messages
