import { reactive } from "vue"

export interface Toast {
  id: number
  text: string
  tone: "info" | "success" | "danger"
}

export const toasts = reactive<Toast[]>([])
let nextId = 1

export function notify(text: string, tone: Toast["tone"] = "info", timeout = 3200): void {
  const id = nextId++
  toasts.push({ id, text, tone })
  setTimeout(() => {
    const index = toasts.findIndex((t) => t.id === id)
    if (index >= 0) toasts.splice(index, 1)
  }, timeout)
}
