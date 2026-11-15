<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import type { FsEntry } from "@/api"
import { folderFilter } from "@/search/state"
import { selection } from "@/stores/selection"
import { formatSize } from "@/utils/format"

const props = defineProps<{ entries: FsEntry[] }>()
const { t } = useI18n()

const shown = computed(() => {
  const needle = folderFilter.text.trim().toLowerCase()
  return needle ? props.entries.filter((e) => e.name.toLowerCase().includes(needle)).length : props.entries.length
})
const picked = computed(() => props.entries.filter((e) => selection.names.has(e.name)))
const pickedSize = computed(() => picked.value.reduce((sum, e) => sum + (e.is_dir ? 0 : e.size), 0))
const hasFiles = computed(() => picked.value.some((e) => !e.is_dir))
</script>

<template>
  <div class="status" role="status" aria-live="polite">
    <span>
      {{ shown === entries.length ? t("explorer.status.items", { count: entries.length }, entries.length) : `${shown} / ${t("explorer.status.items", { count: entries.length }, entries.length)}` }}
    </span>
    <span v-if="picked.length" class="status__selected">
      {{ t("explorer.status.selected", { count: picked.length }) }}<template v-if="hasFiles"> · {{ formatSize(pickedSize) }}</template>
    </span>
  </div>
</template>

<style scoped>
.status {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 16px;
  min-height: 28px;
  padding: 0 16px;
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.status__selected {
  color: var(--fluent-text);
}
</style>
