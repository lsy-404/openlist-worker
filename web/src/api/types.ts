export interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

export interface FsEntry {
  name: string
  size: number
  is_dir: boolean
  created?: string
  modified: string
  sign: string
  thumb: string
  type: number
}

export interface FsList {
  content: FsEntry[] | null
  total: number
  readme: string
  header: string
  write: boolean
  provider: string
}

export interface FsFile extends FsEntry {
  raw_url: string
  readme: string
  header: string
  provider: string
  related: FsEntry[] | null
}

export interface SiteSettings {
  site_title: string
  logo?: string
  favicon?: string
  main_color?: string
  default_page_size?: string
  announcement?: string
  [key: string]: unknown
}

export interface UserInfo {
  id?: number
  username: string
  role: number | number[]
  permission: number
  base_path: string
  disabled?: boolean
}
