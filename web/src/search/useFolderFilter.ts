import { computed, onBeforeUnmount, watch, type Ref } from "vue"
import { folderFilter, searchUi } from "./state"

export function useFolderFilter<T extends { name: string }>(path: () => string, entries: Ref<T[]>) {
  watch(
    path,
    (value) => {
      folderFilter.text = ""
      searchUi.folder = value
    },
    { immediate: true },
  )
  onBeforeUnmount(() => {
    folderFilter.text = ""
    searchUi.folder = null
  })

  const filtered = computed(() => {
    const needle = folderFilter.text.trim().toLowerCase()
    return needle ? entries.value.filter((e) => e.name.toLowerCase().includes(needle)) : entries.value
  })
  return { filtered, filtering: computed(() => !!folderFilter.text.trim()) }
}
