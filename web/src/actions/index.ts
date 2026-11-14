import "./builtin"
import "./fileops"

export { actionLabel, actionsFor, registerAction, unregisterAction } from "./registry"
export type { Action, ActionContext } from "./registry"
export { capsFor } from "./permissions"
export type { FileCaps } from "./permissions"
