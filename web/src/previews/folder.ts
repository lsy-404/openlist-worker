import { ref, watch } from "vue"
import { api, type FsEntry } from "@/api"
import { capsFor } from "@/actions/permissions"
import { passwordFor } from "@/stores/passwords"
import { session } from "@/stores/session"
import { parentPath } from "@/utils/path"

export interface FolderListing {
  files: FsEntry[]
  write: boolean
}

const listings = new Map<string, Promise<FolderListing>>()

/** Cached listing of a folder; the files of the folder plus whether the current user may write there. */
export function listFolder(dir: string): Promise<FolderListing> {
  let cached = listings.get(dir)
  if (!cached) {
    cached = api.fsList(dir, passwordFor(dir)).then((list) => ({
      files: (list.content ?? []).filter((e) => !e.is_dir),
      write: capsFor(list.write).upload,
    }))
    cached.catch(() => listings.delete(dir))
    listings.set(dir, cached)
  }
  return cached
}

export function invalidateFolder(dir: string): void {
  listings.delete(dir)
}

/** Whether the user may write into the folder that holds the file. */
export function useWritable(path: () => string) {
  const writable = ref(false)
  watch(
    path,
    async (value) => {
      writable.value = false
      try {
        const dir = parentPath(value)
        const listing = await listFolder(dir)
        if (dir === parentPath(path())) writable.value = listing.write
      } catch {
        writable.value = false
      }
    },
    { immediate: true },
  )
  return writable
}

const ROLE_GUEST = 1
const ROLE_ADMIN = 2

/** Whether the current user holds a permission bit; positions mirror src/backend/pkg/permission.ts. */
export function userCan(bit: number): boolean {
  const user = session.user
  if (!user || user.disabled) return false
  const roles = [user.role].flat()
  if (roles.includes(ROLE_ADMIN)) return true
  if (roles.includes(ROLE_GUEST)) return false
  return ((user.permission >> bit) & 1) === 1
}

export const PERMISSION_DECOMPRESS = 13
