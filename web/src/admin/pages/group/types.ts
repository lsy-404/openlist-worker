import { PERMISSION_KEYS, bitsFromMask, maskFromBits } from "../user/types"

export interface Scope {
  path: string
  permission: number
}

export interface Group {
  id: number
  name: string
  description: string
  scopes: Scope[]
}

export interface ScopeForm {
  path: string
  bits: boolean[]
}

export interface GroupForm {
  name: string
  description: string
  scopes: ScopeForm[]
}

/** Write content, rename, move, copy and delete. */
export const WRITE_BITS = [3, 4, 5, 6, 7] as const
export const WRITE_MASK = WRITE_BITS.reduce((mask, bit) => mask | (1 << bit), 0)

export type Preset = "read" | "write" | "custom"

export const presetOf = (bits: boolean[]): Preset => {
  const mask = maskFromBits(bits)
  return mask === 0 ? "read" : mask === WRITE_MASK ? "write" : "custom"
}

export const bitsOfPreset = (preset: Exclude<Preset, "custom">) => bitsFromMask(preset === "write" ? WRITE_MASK : 0)

export const emptyScope = (): ScopeForm => ({ path: "/", bits: PERMISSION_KEYS.map(() => false) })
export const emptyGroup = (): GroupForm => ({ name: "", description: "", scopes: [emptyScope()] })

export const scopeToForm = (scope: Scope): ScopeForm => ({ path: scope.path, bits: bitsFromMask(scope.permission) })
