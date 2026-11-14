<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import dismiss from "@fluentui/svg-icons/icons/dismiss_24_regular.svg?raw"
import search from "@fluentui/svg-icons/icons/search_24_regular.svg?raw"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import SearchDialog from "./SearchDialog.vue"
import { openSearch, searchUi } from "./state"

const text = ref(searchUi.query)
const expanded = ref(false)
const input = ref<HTMLInputElement | null>(null)
const placeholder = `搜索文件  ${/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl"} K`

async function focusInput() {
  expanded.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

function onGlobalKey(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
    event.preventDefault()
    void focusInput()
  }
}

function submit() {
  openSearch(text.value)
}

function onEscape() {
  if (text.value) {
    text.value = ""
    return
  }
  input.value?.blur()
  expanded.value = false
}

onMounted(() => window.addEventListener("keydown", onGlobalKey))
onBeforeUnmount(() => window.removeEventListener("keydown", onGlobalKey))
watch(() => searchUi.focusTick, focusInput)
</script>

<template>
  <div class="box" :class="{ 'box--open': expanded }" role="search">
    <FluentButton class="box__toggle" tone="subtle" icon-only aria-label="搜索" title="搜索 (Ctrl+K)" @click="focusInput">
      <FluentSvgIcon :svg="search" :size="20" />
    </FluentButton>

    <form class="box__field" @submit.prevent="submit">
      <FluentSvgIcon :svg="search" :size="16" />
      <input
        ref="input"
        v-model="text"
        class="box__input"
        type="search"
        enterkeyhint="search"
        :placeholder="placeholder"
        aria-label="搜索文件"
        autocomplete="off"
        spellcheck="false"
        @keydown.esc.prevent="onEscape"
      />
      <button class="box__close" type="button" aria-label="关闭搜索" @click="expanded = false">
        <FluentSvgIcon :svg="dismiss" :size="16" />
      </button>
    </form>

    <SearchDialog />
  </div>
</template>

<style scoped>
.box {
  display: flex;
  justify-content: flex-start;
}
.box__toggle,
.box__close {
  display: none;
}
.box__field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 440px;
  height: 34px;
  padding: 0 10px;
  box-sizing: border-box;
  color: var(--fluent-muted);
  background: var(--fluent-control);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.box__field:focus-within {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: 1px;
}
.box__input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fluent-text);
  font: inherit;
}
.box__input::-webkit-search-cancel-button {
  display: none;
}
.box__close {
  align-items: center;
  padding: 4px;
  border: 0;
  border-radius: var(--fluent-radius);
  background: transparent;
  color: inherit;
  cursor: pointer;
}
@media (max-width: 640px) {
  .box {
    justify-content: flex-end;
  }
  .box__toggle {
    display: inline-flex;
  }
  .box__field {
    display: none;
  }
  .box--open .box__toggle {
    display: none;
  }
  .box--open .box__field {
    display: flex;
    position: absolute;
    inset: 0;
    z-index: 1;
    max-width: none;
    height: auto;
    padding: 0 max(16px, env(safe-area-inset-left));
    border: 0;
    border-radius: 0;
    background: var(--fluent-bg);
  }
  .box--open .box__close {
    display: inline-flex;
  }
}
</style>
