<script setup lang="ts">
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"

export interface RowAction {
  label: string
  icon: string
  danger?: boolean
  disabled?: boolean
  run: () => void
}

defineProps<{ items: RowAction[] }>()
</script>

<template>
  <div class="row-actions">
    <FluentButton
      v-for="item in items"
      :key="item.label"
      tone="subtle"
      icon-only
      :class="{ 'row-actions__danger': item.danger }"
      :disabled="item.disabled"
      :aria-label="item.label"
      :title="item.label"
      @click="item.run()"
    >
      <FluentSvgIcon :svg="item.icon" :size="18" />
    </FluentButton>
  </div>
</template>

<style scoped>
.row-actions {
  display: inline-flex;
  gap: 2px;
}
.row-actions__danger {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
</style>
