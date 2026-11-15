import { onBeforeUnmount, onMounted } from "vue"
import { activeDialog } from "@/stores/dialogs"
import { clearSelection } from "@/stores/selection"
import type { Command } from "./commands"

type Bindings = Partial<Record<"remove" | "rename" | "selectAll" | "cut" | "copy" | "paste", Command | null>>

interface Shortcuts {
  /** Folder commands; null while no folder is on screen. */
  commands: () => Bindings | null
  up(): void
  reload(): void
}

const BLOCKED = "input:not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true'], dialog, [role='dialog'], [role='menu']"

export function useShortcuts({ commands, up, reload }: Shortcuts): void {
  function run(name: keyof Bindings): boolean {
    const command = commands()?.[name]
    if (!command || command.disabled) return false
    command.run()
    return true
  }

  function onKey(event: KeyboardEvent) {
    if (event.defaultPrevented || activeDialog.value) return
    if (event.target instanceof Element && event.target.closest(BLOCKED)) return
    const mod = event.ctrlKey || event.metaKey
    const plain = !mod && !event.altKey && !event.shiftKey
    const textSelected = !!window.getSelection()?.toString()
    let handled = false

    if ((event.key === "Backspace" && plain) || (event.key === "ArrowUp" && event.altKey && !mod)) {
      up()
      handled = true
    } else if (event.key === "F5" && plain) {
      reload()
      handled = true
    } else if (commands()) {
      if (event.key === "Delete" && plain) handled = run("remove")
      else if (event.key === "F2" && plain) handled = run("rename")
      else if (event.key === "Escape" && plain) clearSelection()
      else if (mod && !event.altKey && !event.shiftKey) {
        const key = event.key.toLowerCase()
        if (key === "a" && !textSelected) handled = run("selectAll")
        else if (key === "x" && !textSelected) handled = run("cut")
        else if (key === "c" && !textSelected) handled = run("copy")
        else if (key === "v") handled = run("paste")
      }
    }
    if (handled) event.preventDefault()
  }

  onMounted(() => window.addEventListener("keydown", onKey))
  onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
}
