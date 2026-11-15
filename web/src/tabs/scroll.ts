let scroller: HTMLElement | null = null
let cancelRestore = () => {}

export function setScroller(el: HTMLElement | null) {
  scroller = el
}

export const scrollOffset = () => scroller?.scrollTop ?? 0

export function scrollToTop() {
  cancelRestore()
  if (scroller) scroller.scrollTop = 0
}

const RESTORE_MS = 2000
const INTERRUPTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const

/** Re-applies an offset until the content is tall enough to reach it, giving up on user input or timeout. */
export function restoreScroll(top: number) {
  cancelRestore()
  const el = scroller
  if (!el) return
  if (top <= 0) {
    el.scrollTop = 0
    return
  }
  const deadline = performance.now() + RESTORE_MS
  let frame = 0
  const stop = () => {
    cancelAnimationFrame(frame)
    for (const type of INTERRUPTS) el.removeEventListener(type, stop)
    cancelRestore = () => {}
  }
  const tick = () => {
    el.scrollTop = top
    if (Math.abs(el.scrollTop - top) < 1 || performance.now() > deadline) stop()
    else frame = requestAnimationFrame(tick)
  }
  for (const type of INTERRUPTS) el.addEventListener(type, stop, { passive: true })
  cancelRestore = stop
  frame = requestAnimationFrame(tick)
}
