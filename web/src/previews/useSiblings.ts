import { computed, reactive, shallowRef, watch } from "vue"
import { useRouter } from "vue-router"
import type { FsEntry } from "@/api"
import { groupEntries, sortEntries } from "@/browse/arrange"
import { prefs } from "@/stores/prefs"
import { listFolder } from "./folder"
import { encodePath, joinPath, parentPath, splitPath } from "@/utils/path"

/** Set when a player moved on by itself, so the next file starts without another click. */
export const handoff = { play: false }

/** Previous/next files of the same kind in the file's folder. */
export function useSiblings(
  source: () => { path: string; related: FsEntry[] | null },
  accept: (entry: FsEntry) => boolean,
) {
  const router = useRouter()
  const listed = shallowRef<FsEntry[]>([])
  const entries = computed(() => groupEntries(sortEntries(listed.value, prefs.arrange), prefs.arrange).flatMap((g) => g.entries))
  const dir = computed(() => parentPath(source().path))
  const name = computed(() => splitPath(source().path).pop() ?? "")

  watch(
    () => source().path,
    async () => {
      const target = dir.value
      try {
        const files = (await listFolder(target)).files
        if (target === dir.value) listed.value = files
      } catch {
        listed.value = source().related?.filter((e) => !e.is_dir) ?? []
      }
    },
    { immediate: true },
  )

  const siblings = computed(() => entries.value.filter((e) => accept(e) || e.name === name.value))
  const index = computed(() => siblings.value.findIndex((e) => e.name === name.value))

  function go(offset: number, play = false) {
    const target = siblings.value[index.value + offset]
    if (!target) return
    handoff.play = play
    void router.push(encodePath(joinPath(dir.value, target.name)))
  }

  return reactive({
    dir,
    /** Every file of the folder, whatever its kind. */
    all: entries,
    siblings,
    index,
    total: computed(() => siblings.value.length),
    hasPrev: computed(() => index.value > 0),
    hasNext: computed(() => index.value >= 0 && index.value < siblings.value.length - 1),
    prev: () => go(-1),
    next: (play = false) => go(1, play),
    goTo: (name: string) => {
      handoff.play = true
      void router.push(encodePath(joinPath(dir.value, name)))
    },
  })
}
