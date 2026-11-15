<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { previewIcons } from "./icons"

const { t } = useI18n()
defineProps<{ nav: { index: number; total: number; hasPrev: boolean; hasNext: boolean; prev(): void; next(): void } }>()
</script>

<template>
  <div v-if="nav.total > 1" class="nav">
    <FluentButton tone="subtle" icon-only :disabled="!nav.hasPrev" :aria-label="t('preview.siblings.prev')" @click="nav.prev()">
      <FluentSvgIcon :svg="previewIcons.chevronLeft" :size="18" />
    </FluentButton>
    <span class="nav__count">{{ nav.index + 1 }} / {{ nav.total }}</span>
    <FluentButton tone="subtle" icon-only :disabled="!nav.hasNext" :aria-label="t('preview.siblings.next')" @click="nav.next()">
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
