<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentNotice, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { icons } from "@/utils/icons"

const props = defineProps<{
  open: boolean
  title: string
  busy?: boolean
  error?: string | null
  submitLabel?: string
}>()
const emit = defineEmits<{ "update:open": [value: boolean]; submit: [] }>()

const { t } = useI18n()
const dialog = ref<HTMLDialogElement | null>(null)

// A native modal dialog supplies the focus trap, Escape handling and top layer
watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  },
  { immediate: true },
)

function onBackdrop(event: MouseEvent) {
  if (event.target === dialog.value && !props.busy) emit("update:open", false)
}

function onCancel(event: Event) {
  if (props.busy) event.preventDefault()
}
</script>

<template>
  <dialog ref="dialog" class="panel" :aria-label="title" @close="emit('update:open', false)" @cancel="onCancel" @click="onBackdrop">
    <form v-if="open" class="panel__form" @submit.prevent="emit('submit')">
      <header class="panel__head">
        <h2 class="panel__title">{{ title }}</h2>
        <FluentButton tone="subtle" icon-only type="button" :aria-label="t('common.close')" :disabled="busy" @click="emit('update:open', false)">
          <FluentSvgIcon :svg="icons.dismiss" :size="18" />
        </FluentButton>
      </header>
      <div class="panel__body">
        <FluentNotice v-if="error" tone="danger">{{ error }}</FluentNotice>
        <slot />
      </div>
      <footer class="panel__foot">
        <FluentButton tone="primary" type="submit" :busy="busy">{{ submitLabel ?? t("admin.panel.save") }}</FluentButton>
        <FluentButton type="button" :disabled="busy" @click="emit('update:open', false)">{{ t("common.cancel") }}</FluentButton>
      </footer>
    </form>
  </dialog>
</template>

<style scoped>
.panel {
  box-sizing: border-box;
  width: min(480px, 100vw);
  height: 100dvh;
  max-width: none;
  max-height: none;
  margin: 0 0 0 auto;
  padding: 0;
  border: none;
  border-inline-start: 1px solid var(--fluent-border);
  background: var(--fluent-surface);
  color: var(--fluent-text);
  box-shadow: var(--fluent-shadow);
}
.panel::backdrop {
  background: rgba(0, 0, 0, 0.35);
}
.panel__form {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--fluent-border);
}
.panel__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}
.panel__body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}
.panel__foot {
  display: flex;
  gap: 8px;
  padding: 12px 16px max(12px, env(safe-area-inset-bottom));
  border-top: 1px solid var(--fluent-border);
}
</style>
