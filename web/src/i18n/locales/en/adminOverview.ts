import type zh from "../zh-CN/adminOverview"

const messages: typeof zh = {
  title: "Overview",
  description: "Health of storages, users and the search index at a glance.",
  unavailable: "Unavailable",
  storages: "Storages",
  storageDetail: "{working} working, {failing} failing, {disabled} disabled",
  users: "Users",
  userDetail: "{disabled} disabled",
  metas: "Metas",
  metaDetail: "Path rules",
  index: "Search index",
  indexReady: "Objects, ready",
  indexRunning: "Objects, building",
  indexError: "Objects, last build failed",
  version: "Backend version {version}",
}

export default messages
