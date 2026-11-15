export interface Meta {
  id: number
  path: string
  password: string
  p_sub: boolean
  write: boolean
  w_sub: boolean
  hide: string
  h_sub: boolean
  readme: string
  r_sub: boolean
}

export type MetaForm = Omit<Meta, "id">

export const emptyMeta = (): MetaForm => ({
  path: "",
  password: "",
  p_sub: false,
  write: false,
  w_sub: false,
  hide: "",
  h_sub: false,
  readme: "",
  r_sub: false,
})
