import type zh from "../zh-CN/tasks"

const messages: typeof zh = {
  title: "Tasks",
  description: "Uploads, copies, moves, deletions and other operations from this session. Tasks in progress stop when you close the tab.",
  headerLabel: "Tasks",
  headerLabelRunning: "Tasks, {count} running",
  items: "{count} items",
  filters: {
    label: "Filter tasks",
    all: "All",
    running: "Running",
    finished: "Finished",
    failed: "Failed",
  },
  kind: {
    upload: "Upload",
    copy: "Copy",
    move: "Move",
    delete: "Delete",
    rename: "Rename",
    mkdir: "New folder",
  },
  state: {
    queued: "Queued",
    running: "Running",
    succeeded: "Done",
    failed: "Failed",
    cancelled: "Cancelled",
    interrupted: "Interrupted",
  },
  detail: {
    started: "Started {time}",
    took: "Took {duration}",
    elapsed: "Running for {duration}",
  },
  interruptedHint: "This task had not finished when the page was reloaded, so its outcome is unknown. Check the destination before retrying.",
  actions: {
    cancel: "Cancel",
    cancelItem: "Cancel {name}",
    retry: "Retry",
    retryItem: "Retry {name}",
    open: "Open folder",
    openItem: "Open the folder of {name}",
    dismiss: "Remove",
    dismissItem: "Remove {name} from the list",
    cancelAll: "Cancel all",
    clearFinished: "Clear finished",
  },
  progress: "Progress of {name}",
  empty: {
    all: { title: "No tasks yet", detail: "Uploads, copies, moves and deletions will show up here." },
    running: { title: "Nothing is running", detail: "All tasks have finished." },
    finished: { title: "No finished tasks", detail: "Finished tasks are kept until this session ends." },
    failed: { title: "No failed tasks", detail: "Everything went fine." },
  },
  panel: { viewAll: "View all" },
}
export default messages
