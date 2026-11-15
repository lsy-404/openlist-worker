// Height hooks for <Transition name="collapse">; the durations and curves live in the collapse-* classes
function box(el: Element): HTMLElement {
  return el as HTMLElement
}

export const collapse = {
  // A height that does not change fires no transitionend, so the end is timed rather than awaited
  duration: { enter: 270, leave: 190 },
  onBeforeEnter(el: Element) {
    box(el).style.height = "0"
  },
  onEnter(el: Element) {
    void box(el).offsetHeight
    box(el).style.height = `${box(el).scrollHeight}px`
  },
  onAfterEnter(el: Element) {
    box(el).style.height = ""
  },
  onBeforeLeave(el: Element) {
    box(el).style.height = `${box(el).scrollHeight}px`
  },
  onLeave(el: Element) {
    void box(el).offsetHeight
    box(el).style.height = "0"
  },
  onAfterLeave(el: Element) {
    box(el).style.height = ""
  },
}
