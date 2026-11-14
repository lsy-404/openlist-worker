<script setup lang="ts">
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { previewIcons } from "./icons"

defineProps<{ index: number; total: number; hasPrev: boolean; hasNext: boolean }>()
defineEmits<{ prev: []; next: [] }>()
</script>

<template>
  <div v-if="total > 1" class="nav">
    <FluentButton tone="subtle" icon-only :disabled="!hasPrev" aria-label="上一个" @click="$emit('prev')">
      <FluentSvgIcon :svg="previewIcons.chevronLeft" :size="18" />
    </FluentButton>
    <span class="nav__count">{{ index + 1 }} / {{ total }}</span>
    <FluentButton tone="subtle" icon-only :disabled="!hasNext" aria-label="下一个" @click="$emit('next')">
      <FluentSvgIcon :svg="previewIcons.chevronRight" :size="18" />
    </FluentButton>
  </div>
</template>

<style scoped>
.nav {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.nav__count {
  min-width: 4.5em;
  text-align: center;
  color: var(--fluent-muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
</style>
