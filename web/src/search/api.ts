import { request, type FsEntry } from "@/api"

export interface SearchHit extends FsEntry {
  parent: string
}

export interface SearchPage {
  content: SearchHit[] | null
  total: number
}

export const SEARCH_PAGE_SIZE = 30
const SEARCH_TIMEOUT_MS = 120_000

export function searchFiles(
  params: { parent: string; keywords: string; page: number; password: string },
  signal: AbortSignal,
): Promise<SearchPage> {
  return request<SearchPage>(
    "POST",
    "/api/fs/search",
    { ...params, scope: 0, per_page: SEARCH_PAGE_SIZE },
    signal,
    SEARCH_TIMEOUT_MS,
  )
}
