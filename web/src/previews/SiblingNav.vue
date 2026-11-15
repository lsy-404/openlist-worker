<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { previewIcons } from "./icons"

const { t } = useI18n()
defineProps<{ index: number; total: number; hasPrev: boolean; hasNext: boolean }>()
defineEmits<{ prev: []; next: [] }>()
</script>

<template>
  <div v-if="total > 1" class="nav">
    <FluentButton tone="subtle" icon-only :disabled="!hasPrev" :aria-label="t('preview.siblings.prev')" @click="$emit('prev')">
      <FluentSvgIcon :svg="previewIcons.chevronLeft" :size="18" />
    </FluentButton>
    <span class="nav__count">{{ index + 1 }} / {{ total }}</span>
    <FluentButton tone="subtle" icon-only :disabled="!hasNext" :aria-label="t('preview.siblings.next')" @click="$emit('next')">
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
