<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { FluentButton, FluentProgressBar, FluentSvgIcon } from "@platform-kit/fluent/vue"
import {
  cancelAll,
  cancelUpload,
  clearFinished,
  pending,
  retryUpload,
  uploads,
  type UploadItem,
  type UploadStatus,
} from "@/stores/uploads"
import { formatSize } from "@/utils/format"
import { icons } from "@/utils/icons"

const { t } = useI18n()
const total = computed(() => uploads.items.length)
const finished = computed(() => uploads.items.filter((i) => i.status === "done").length)
const failed = computed(() => uploads.items.filter((i) => i.status === "failed").length)
const busy = computed(() => (uploads.items.length ? pending() > 0 : false))
const bytes = computed(() => uploads.items.reduce((sum, i) => sum + i.size, 0))
const sent = computed(() => uploads.items.reduce((sum, i) => sum + i.loaded, 0))

const summary = computed(() => {
  if (busy.value) return t("files.uploads.uploading", { done: finished.value, total: total.value })
  return failed.value ? t("files.uploads.failedCount", { count: failed.value }) : t("files.uploads.doneCount", { count: finished.value })
})

const statusText = (status: UploadStatus) => t(`files.uploads.status.${status}`)

function detail(item: UploadItem): string {
  if (item.status === "failed") return item.error || t("errors.uploadFailed")
  if (item.status === "uploading") return `${formatSize(item.loaded)} / ${formatSize(item.size)}`
  return `${statusText(item.status)} · ${formatSize(item.size)}`
}
</script>

<template>
  <section v-if="total" class="uploads" :aria-label="t('files.uploads.queue')">
    <header class="uploads__head">
      <button
        type="button"
        class="uploads__toggle"
        :aria-expanded="uploads.expanded"
        aria-controls="upload-list"
        @click="uploads.expanded = !uploads.expanded"
      >
        <FluentSvgIcon :svg="icons.arrowUpload" :size="18" />
        <span class="uploads__summary" aria-live="polite">{{ summary }}</span>
        <FluentSvgIcon :svg="uploads.expanded ? icons.arrowDown : icons.arrowUp" :size="14" />
      </button>
      <FluentButton v-if="busy" tone="subtle" @click="cancelAll">{{ t("files.uploads.cancelAll") }}</FluentButton>
      <FluentButton v-else tone="subtle" icon-only :aria-label="t('files.uploads.clearFinished')" :title="t('files.uploads.clearFinished')" @click="clearFinished">
        <FluentSvgIcon :svg="icons.dismiss" :size="18" />
      </FluentButton>
    </header>
    <FluentProgressBar v-if="busy" :value="sent" :max="bytes || 1" :label="t('files.uploads.totalProgress')" class="uploads__total" />

    <ul v-show="uploads.expanded" id="upload-list" class="uploads__list">
      <li v-for="item in uploads.items" :key="item.id" class="item" :data-status="item.status">
        <div class="item__main">
          <span class="item__name" :title="item.name">{{ item.name }}</span>
          <span class="item__detail">{{ detail(item) }}</span>
          <FluentProgressBar
            v-if="item.status === 'uploading'"
            :value="item.loaded"
            :max="item.size || 1"
            :label="t('files.uploads.progressOf', { name: item.name })"
          />
        </div>
        <FluentButton
          v-if="item.status === 'queued' || item.status === 'uploading'"
          tone="subtle"
          icon-only
          :aria-label="t('files.uploads.cancelItem', { name: item.name })"
          :title="t('common.cancel')"
          @click="cancelUpload(item)"
        >
          <FluentSvgIcon :svg="icons.dismiss" :size="16" />
        </FluentButton>
        <FluentButton
          v-else-if="item.status === 'failed' || item.status === 'cancelled'"
          tone="subtle"
          icon-only
          :aria-label="t('files.uploads.retryItem', { name: item.name })"
          :title="t('common.retry')"
          @click="retryUpload(item)"
        >
          <FluentSvgIcon :svg="icons.arrowCounterclockwise" :size="16" />
        </FluentButton>
        <FluentSvgIcon v-else :svg="icons.checkmark" :size="16" class="item__ok" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
.uploads {
  position: fixed;
  inset-inline-end: max(16px, env(safe-area-inset-right));
  bottom: max(16px, env(safe-area-inset-bottom));
  z-index: 40;
  width: min(380px, calc(100vw - 32px));
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
  box-shadow: var(--fluent-shadow);
  overflow: hidden;
}
.uploads__head {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 4px 4px 8px;
}
.uploads__toggle {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 4px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
  border-radius: var(--fluent-radius);
}
.uploads__toggle:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.uploads__summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.uploads__list {
  list-style: none;
  margin: 0;
  padding: 0 4px 4px;
  max-height: min(320px, 45vh);
  overflow: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px 6px 8px;
  border-top: 1px solid var(--fluent-border);
}
.item__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item__detail {
  color: var(--fluent-muted);
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}
.item[data-status="failed"] .item__detail {
  color: var(--fluent-danger);
}
.item__ok {
  margin-inline: 8px;
  color: var(--fluent-muted);
}
@media (max-width: 640px) {
  .uploads {
    inset-inline: 8px;
    width: auto;
  }
}
</style>
