<script setup lang="ts">
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { formatDate, formatSize } from "@/utils/format"
import { iconForEntry } from "@/utils/icons"
import type { PreviewProps } from "./registry"

defineProps<Pick<PreviewProps, "file">>()
</script>

<template>
  <div class="card">
    <FluentSvgIcon :svg="iconForEntry(file)" :size="56" />
    <p class="card__name">{{ file.name }}</p>
    <p class="card__meta">{{ formatSize(file.size) }} · {{ formatDate(file.modified) }}</p>
    <div class="card__actions"><slot /></div>
    <slot name="after" />
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  color: var(--fluent-muted);
}
.card p {
  margin: 0;
}
.card__name {
  color: var(--fluent-text);
  font-weight: 600;
  overflow-wrap: anywhere;
}
.card__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
</style>
