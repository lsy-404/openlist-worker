import type zh from "../zh-CN/adminIndex"

const messages: typeof zh = {
  title: "Search index",
  description: "Build an index for file search. A build walks every storage and can take a while on large ones.",
  status: "Index status",
  state: "State",
  idle: "Idle",
  running: "Building",
  failed: "Last build failed",
  objects: "Indexed objects",
  lastDone: "Last completed",
  never: "Never",
  paths: "Paths to update",
  pathsHelp: "One path per line, used by Update index only. Leave empty for the root.",
  actions: { build: "Rebuild index", update: "Update index", stop: "Stop", clear: "Clear" },
  done: { build: "Index rebuilt", update: "Index updated", stop: "Stopped", clear: "Index cleared" },
  clear: { title: "Clear index", message: "Search will no longer use the existing index until it is rebuilt. Continue?", confirm: "Clear" },
  stop: { title: "Stop build", message: "Stop the current index job?", confirm: "Stop" },
}

export default messages
