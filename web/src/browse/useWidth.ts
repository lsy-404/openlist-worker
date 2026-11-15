import { onBeforeUnmount, onMounted, ref, type Ref } from "vue"

export function useWidth(el: Ref<HTMLElement | null>): Ref<number> {
  const width = ref(Infinity)
  let observer: ResizeObserver | null = null
  onMounted(() => {
    if (!el.value || typeof ResizeObserver === "undefined") return
    observer = new ResizeObserver(([entry]) => (width.value = entry.contentRect.width))
    observer.observe(el.value)
  })
  onBeforeUnmount(() => observer?.disconnect())
  return width
}
