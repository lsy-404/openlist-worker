import { shallowRef } from "vue"
import type { Share } from "./api"

type Target = { kind: "create"; files: string[] } | { kind: "edit"; share: Share }
export type ShareRequest = Target & { settle(changed: boolean): void }

export const activeShare = shallowRef<ShareRequest | null>(null)

/** Resolves true when a share was created or changed. */
export function askShare(target: Target): Promise<boolean> {
  return new Promise((settle) => (activeShare.value = { ...target, settle }))
}

export function closeShare(): void {
  activeShare.value = null
}
