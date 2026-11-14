import { reactive } from "vue"

export type SearchScope = "folder" | "site"

export const searchUi = reactive({
  query: "",
  open: false,
  scope: "folder" as SearchScope,
  folder: null as string | null,
  focusTick: 0,
})

export const folderFilter = reactive({ text: "" })

export function focusSearchBox(): void {
  searchUi.focusTick++
}

export function openSearch(query: string): void {
  searchUi.query = query.trim()
  if (searchUi.query) searchUi.open = true
}
