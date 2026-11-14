<script setup lang="ts">
import { FluentNotice } from "@platform-kit/fluent/vue"
import { toasts } from "@/stores/toast"
</script>

<template>
  <div class="toasts" aria-live="polite">
    <FluentNotice v-for="t in toasts" :key="t.id" :tone="t.tone === 'danger' ? 'danger' : t.tone === 'success' ? 'success' : 'info'">
      {{ t.text }}
    </FluentNotice>
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
</style>
