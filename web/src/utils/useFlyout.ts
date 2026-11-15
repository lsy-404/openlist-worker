import { onBeforeUnmount, ref } from "vue"

/** Open state for a popover whose exit animation has to finish before it is removed. */
export function useFlyout() {
  const open = ref(false)
  const closing = ref(false)
  let fallback = 0

  function finish() {
    clearTimeout(fallback)
    open.value = false
    closing.value = false
  }

  function requestClose() {
    if (!open.value || closing.value) return
    closing.value = true
    fallback = window.setTimeout(finish, 300)
  }

  function toggle() {
    if (open.value) requestClose()
    else open.value = true
  }

  function onAnimationEnd(event: AnimationEvent) {
    if (closing.value && event.target === event.currentTarget) finish()
  }

  onBeforeUnmount(() => clearTimeout(fallback))
  return { open, closing, toggle, requestClose, onAnimationEnd }
}
