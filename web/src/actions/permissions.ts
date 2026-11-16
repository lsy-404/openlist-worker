import { session } from "@/stores/session"

// Bit positions and roles mirror src/backend/pkg/permission.ts
const WRITE_CONTENT = 3
const RENAME = 4
const MOVE = 5
const COPY = 6
const DELETE = 7
const SHARE = 14
const CUSTOMIZE_SHARE_ID = 15
const ROLE_GUEST = 1
const ROLE_ADMIN = 2

export interface FileCaps {
  upload: boolean
  mkdir: boolean
  rename: boolean
  move: boolean
  copy: boolean
  remove: boolean
}

export const NO_CAPS: FileCaps = { upload: false, mkdir: false, rename: false, move: false, copy: false, remove: false }

function holds(bit: number): boolean {
  const user = session.user
  if (!user || user.disabled) return false
  const roles = [user.role].flat()
  if (roles.includes(ROLE_ADMIN)) return true
  if (roles.includes(ROLE_GUEST)) return false
  return ((user.permission >> bit) & 1) === 1
}

export const canShare = (): boolean => holds(SHARE)
export const canCustomizeShareId = (): boolean => holds(CUSTOMIZE_SHARE_ID)

/**
 * Operations the current user may perform in a folder. `writable` is the `write` flag of the folder
 * listing, which already folds in the WRITE_CONTENT bit and the folder's write_users list; the other
 * operations have their own permission bits but share that list, so it only applies when the user
 * holds WRITE_CONTENT (otherwise the flag is false for every folder and says nothing about the list).
 */
export function capsFor(writable: boolean | undefined): FileCaps {
  if (writable === undefined) return NO_CAPS
  const listAllows = holds(WRITE_CONTENT) ? writable : true
  return {
    upload: writable,
    mkdir: writable,
    rename: holds(RENAME) && listAllows,
    move: holds(MOVE) && listAllows,
    copy: holds(COPY) && listAllows,
    remove: holds(DELETE) && listAllows,
  }
}
