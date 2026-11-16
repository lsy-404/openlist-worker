import "./builtin"
import "./fileops"
import "./share"
import "@/tabs/action"

export { actionLabel, actionsFor, registerAction, unregisterAction } from "./registry"
export type { Action, ActionContext } from "./registry"
export { capsFor } from "./permissions"
export type { FileCaps } from "./permissions"
