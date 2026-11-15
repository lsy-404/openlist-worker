<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { ref, watch } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { notify } from "@/stores/toast"
import { formatDate, formatSize } from "@/utils/format"
import BufferGate from "./BufferGate.vue"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"
import { parseTorrent, type TorrentInfo } from "./torrent"
import { useFileBuffer } from "./useFileBuffer"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, buffer, error, load } = useFileBuffer(() => ({ url: props.downloadUrl, size: props.file.size }), 8 * 1024 * 1024)

const info = ref<TorrentInfo | null>(null)
const failed = ref("")

watch(buffer, async (data) => {
  info.value = null
  failed.value = ""
  if (!data) return
  try {
    info.value = await parseTorrent(data)
  } catch {
    failed.value = t("preview.torrent.invalid")
  }
})

async function copy(value: string) {
  try {
    await navigator.clipboard.writeText(value)
    notify(t("preview.download.copied"), "success")
  } catch {
    notify(t("preview.download.copyFailed"), "danger")
  }
}
</script>

<template>
  <div>
    <BufferGate
      v-if="status !== 'ready' || failed"
      :status="status"
      :error="error"
      :failed="failed"
      :size="file.size"
      :download-url="downloadUrl"
      :filename="file.name"
      @load="load"
    />
    <div v-else-if="info" class="torrent">
      <h2 class="torrent__name">{{ info.name }}</h2>
      <dl class="torrent__meta">
        <div>
          <dt>{{ t("preview.torrent.size") }}</dt>
          <dd>{{ formatSize(info.size) }}</dd>
        </div>
        <div>
          <dt>{{ t("preview.torrent.fileCount") }}</dt>
          <dd>{{ info.files.length }}</dd>
        </div>
        <div v-if="info.created">
          <dt>{{ t("preview.torrent.created") }}</dt>
          <dd>{{ formatDate(new Date(info.created).toISOString()) }}</dd>
        </div>
        <div v-if="info.createdBy">
          <dt>{{ t("preview.torrent.createdBy") }}</dt>
          <dd>{{ info.createdBy }}</dd>
        </div>
        <div>
          <dt>{{ t("preview.torrent.infoHash") }}</dt>
          <dd class="mono">{{ info.infoHash }}</dd>
        </div>
        <div v-if="info.comment">
          <dt>{{ t("preview.torrent.comment") }}</dt>
          <dd>{{ info.comment }}</dd>
        </div>
      </dl>
      <div class="torrent__actions">
        <FluentButton tone="primary" @click="copy(info.magnet)">
          <FluentSvgIcon :svg="previewIcons.link" :size="18" />
          {{ t("preview.torrent.copyMagnet") }}
        </FluentButton>
      </div>
      <details v-if="info.trackers.length" class="torrent__section">
        <summary>{{ t("preview.torrent.trackers", { count: info.trackers.length }) }}</summary>
        <ul class="plain">
          <li v-for="tracker in info.trackers" :key="tracker" class="mono">{{ tracker }}</li>
        </ul>
      </details>
      <section class="torrent__section">
        <h3>{{ t("preview.torrent.files") }}</h3>
        <ul class="plain files">
          <li v-for="f in info.files" :key="f.path">
            <span class="files__path">{{ f.path }}</span>
            <span class="files__size">{{ formatSize(f.size) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
.torrent {
  padding: 20px;
}
.torrent__name {
  margin: 0 0 12px;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.torrent__meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 8px 24px;
  margin: 0 0 16px;
}
.torrent__meta div {
  display: flex;
  flex-direction: column;
}
.torrent__meta dt {
  color: var(--fluent-muted);
  font-size: 0.8rem;
}
.torrent__meta dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.mono {
  font-family: "Cascadia Mono", Consolas, ui-monospace, monospace;
  font-size: 0.85rem;
}
.torrent__actions {
  margin-bottom: 16px;
}
.torrent__section {
  margin-top: 12px;
}
.torrent__section h3 {
  margin: 0 0 8px;
  font-size: 0.95rem;
}
.plain {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.plain li {
  overflow-wrap: anywhere;
}
.files {
  max-height: 360px;
  overflow: auto;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.files li {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--fluent-border);
}
.files li:last-child {
  border-bottom: 0;
}
.files__size {
  flex: none;
  color: var(--fluent-muted);
  font-variant-numeric: tabular-nums;
}
</style>
