import { nextTick, onBeforeUnmount, watch, type Ref } from "vue"

const BAR_HEIGHT = 16

/** Keeps one accent bar centred on the active item and slides it when the active item changes. */
export function useSlidingIndicator(root: Ref<HTMLElement | null>, bar: Ref<HTMLElement | null>, selector: string, key: () => unknown) {
  let placed = false
  let sliding = false
  let timer = 0

  function place(slide: boolean) {
    const host = root.value
    const el = bar.value
    if (!host || !el) return
    const target = host.querySelector<HTMLElement>(selector)
    if (!target) {
      el.style.opacity = "0"
      placed = false
      return
    }
    const hostRect = host.getBoundingClientRect()
    const rect = target.getBoundingClientRect()
    const y = rect.top - hostRect.top + host.scrollTop + (rect.height - BAR_HEIGHT) / 2
    if (slide && placed) {
      sliding = true
      window.clearTimeout(timer)
      timer = window.setTimeout(() => (sliding = false), 400)
    }
    const snap = !sliding
    if (snap) el.style.transitionProperty = placed ? "none" : "opacity"
    el.style.transform = `translateY(${y}px)`
    el.style.opacity = "1"
    if (snap) {
      void el.offsetHeight
      el.style.transitionProperty = ""
    }
    placed = true
  }

  watch(
    root,
    (host, _, onCleanup) => {
      if (!host) return
      const observer = new ResizeObserver(() => place(false))
      observer.observe(host)
      onCleanup(() => observer.disconnect())
      place(false)
    },
    { flush: "post" },
  )
  watch(key, async () => {
    await nextTick()
    place(true)
  })
  onBeforeUnmount(() => window.clearTimeout(timer))
}
