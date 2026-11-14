<script setup lang="ts">
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import type { ActionContext } from "@/actions"
import { icons } from "@/utils/icons"
import ActionBar from "./ActionBar.vue"

defineProps<{ ctx: ActionContext }>()
const emit = defineEmits<{ clear: [] }>()
</script>

<template>
  <div class="selbar" role="region" aria-label="批量操作">
    <FluentButton tone="subtle" icon-only aria-label="取消选择" title="取消选择" @click="emit('clear')">
      <FluentSvgIcon :svg="icons.dismiss" :size="18" />
    </FluentButton>
    <span class="selbar__count" aria-live="polite">已选择 {{ ctx.selection.length }} 项</span>
    <ActionBar :ctx="ctx" class="selbar__actions" />
  </div>
</template>

<style scoped>
.selbar {
  position: sticky;
  bottom: max(12px, env(safe-area-inset-bottom));
  z-index: 30;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 8px 12px;
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
  box-shadow: var(--fluent-shadow);
}
.selbar__count {
  font-weight: 600;
}
.selbar__actions {
  margin-inline-start: auto;
}
</style>
