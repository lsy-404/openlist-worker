export const ROLE_GENERAL = 0
export const ROLE_GUEST = 1
export const ROLE_ADMIN = 2

export interface User {
  id: number
  username: string
  role: number
  permission: number
  base_path: string
  disabled: boolean
  sso_id: string
  otp: boolean
  groups?: number[]
  sso_groups?: string[]
}

export interface UserForm {
  username: string
  password: string
  base_path: string
  disabled: boolean
  sso_id: string
  bits: boolean[]
  groups: number[]
}

/** Bit indexes mirror the backend PermissionBit table, grouped for display. */
export const PERMISSION_GROUPS = [
  { key: "browse", bits: [0, 1] },
  { key: "files", bits: [3, 4, 5, 6, 7, 2, 12, 13] },
  { key: "share", bits: [14, 15] },
  { key: "protocols", bits: [8, 9, 10, 11] },
] as const

export const PERMISSION_KEYS = [
  "seeHides",
  "accessWithoutPassword",
  "offlineDownload",
  "writeContent",
  "rename",
  "move",
  "copy",
  "delete",
  "webdavRead",
  "webdavManage",
  "ftpRead",
  "ftpManage",
  "readArchives",
  "decompress",
  "share",
  "customizeShareId",
] as const

export const emptyUser = (): UserForm => ({
  username: "",
  password: "",
  base_path: "/",
  disabled: false,
  sso_id: "",
  bits: PERMISSION_KEYS.map(() => false),
  groups: [],
})

export const bitsFromMask = (mask: number) => PERMISSION_KEYS.map((_, i) => ((mask >> i) & 1) === 1)
export const maskFromBits = (bits: boolean[]) => bits.reduce((mask, on, i) => (on ? mask | (1 << i) : mask), 0)
