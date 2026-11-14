import { computed, reactive, shallowRef, watch } from "vue"
import { useRouter } from "vue-router"
import { api, type FsEntry } from "@/api"
import { passwordFor } from "@/stores/passwords"
import { encodePath, joinPath, parentPath, splitPath } from "@/utils/path"

const listings = new Map<string, FsEntry[]>()

async function listFiles(dir: string): Promise<FsEntry[]> {
  const cached = listings.get(dir)
  if (cached) return cached
  const list = await api.fsList(dir, passwordFor(dir))
  const files = (list.content ?? []).filter((e) => !e.is_dir)
  listings.set(dir, files)
  return files
}

/** Previous/next files of the same kind in the file's folder. */
export function useSiblings(
  source: () => { path: string; related: FsEntry[] | null },
  accept: (entry: FsEntry) => boolean,
) {
  const router = useRouter()
  const entries = shallowRef<FsEntry[]>([])
  const dir = computed(() => parentPath(source().path))
  const name = computed(() => splitPath(source().path).pop() ?? "")

  watch(
    () => source().path,
    async () => {
      const related = source().related?.filter((e) => !e.is_dir) ?? []
      if (related.length > 1) {
        entries.value = related
        return
      }
      const target = dir.value
      try {
        const files = await listFiles(target)
        if (target === dir.value) entries.value = files
      } catch {
        entries.value = []
      }
    },
    { immediate: true },
  )

  const siblings = computed(() => entries.value.filter((e) => accept(e) || e.name === name.value))
  const index = computed(() => siblings.value.findIndex((e) => e.name === name.value))

  function go(offset: number) {
    const target = siblings.value[index.value + offset]
    if (target) void router.push(encodePath(joinPath(dir.value, target.name)))
  }

  return reactive({
    index,
    total: computed(() => siblings.value.length),
    hasPrev: computed(() => index.value > 0),
    hasNext: computed(() => index.value >= 0 && index.value < siblings.value.length - 1),
    prev: () => go(-1),
    next: () => go(1),
  })
}
