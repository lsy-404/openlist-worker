<script setup lang="ts">
import { FluentNotice } from "@platform-kit/fluent/vue"
import { toasts } from "@/stores/toast"
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <FluentNotice v-for="t in toasts" :key="t.id" :tone="t.tone === 'danger' ? 'danger' : t.tone === 'success' ? 'success' : 'info'">
        {{ t.text }}
      </FluentNotice>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed;
  inset-inline: 0;
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 50;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}
.toasts :deep(.fluent-notice) {
  pointer-events: auto;
  box-shadow: var(--fluent-shadow);
  background: var(--fluent-surface);
}
.toast-enter-active {
  transition:
    opacity var(--fluent-normal) var(--fluent-ease),
    transform var(--fluent-normal) var(--fluent-ease);
}
.toast-leave-active {
  transition:
    opacity var(--fluent-fast) var(--fluent-ease-accelerate),
    transform var(--fluent-fast) var(--fluent-ease-accelerate);
}
.toast-move {
  transition: transform var(--fluent-normal) var(--motion-ease-move);
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(var(--motion-rise));
}
.toast-leave-to {
  opacity: 0;
  transform: translateY(calc(var(--motion-rise) / 2));
}
</style>
