<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, ref, watch } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError, request } from "@/api"
import { passwordFor } from "@/stores/passwords"
import { notify } from "@/stores/toast"
import { formatDate, formatSize } from "@/utils/format"
import { iconForEntry } from "@/utils/icons"
import { joinPath, parentPath } from "@/utils/path"
import { invalidateFolder, PERMISSION_DECOMPRESS, useWritable, userCan } from "./folder"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { previewIcons } from "./icons"
import { stem } from "./kinds"
import type { PreviewProps } from "./registry"

interface Node {
  name: string
  size: number
  is_dir: boolean
  modified: string
  type: number
  children?: Node[]
}

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const writable = useWritable(() => props.path)

const status = ref<"loading" | "ready" | "error">("loading")
const message = ref("")
const unsupported = ref(false)
const tree = ref<Node[]>([])
const inner = ref<string[]>([])
const extracting = ref(false)
let token = 0

const canExtract = computed(() => writable.value && userCan(PERMISSION_DECOMPRESS))

const entries = computed(() => {
  let level = tree.value
  for (const part of inner.value) level = level.find((n) => n.is_dir && n.name === part)?.children ?? []
  return [...level].sort((a, b) => Number(b.is_dir) - Number(a.is_dir) || a.name.localeCompare(b.name, undefined, { numeric: true }))
})

async function load() {
  const current = ++token
  status.value = "loading"
  unsupported.value = false
  inner.value = []
  try {
    const dir = parentPath(props.path)
    const data = await request<{ content: Node[] | null }>("POST", "/api/fs/archive/meta", { path: props.path, password: passwordFor(dir) }, undefined, 120_000)
    if (current !== token) return
    tree.value = data.content ?? []
    status.value = "ready"
  } catch (err) {
    if (current !== token) return
    unsupported.value = err instanceof ApiError && (err.code === 501 || err.code === 400)
    message.value = err instanceof ApiError && err.kind === "forbidden" ? t("preview.archive.forbidden") : unsupported.value ? "" : err instanceof Error ? err.message : String(err)
    status.value = "error"
  }
}

async function extract() {
  extracting.value = true
  const dir = parentPath(props.path)
  try {
    await request(
      "POST",
      "/api/fs/archive/decompress",
      { src_dir: dir, dst_dir: joinPath(dir, stem(props.file.name)), name: [props.file.name], inner_path: "" },
      undefined,
      600_000,
    )
    invalidateFolder(dir)
    notify(t("preview.archive.extracted", { folder: stem(props.file.name) }), "success")
  } catch (err) {
    notify(t("preview.archive.extractFailed", { reason: err instanceof Error ? err.message : String(err) }), "danger")
  } finally {
    extracting.value = false
  }
}

watch(() => props.path, () => void load(), { immediate: true })
</script>

<template>
  <div>
    <PreviewNotice v-if="status === 'loading'" tone="loading" :title="t('preview.archive.reading')" />
    <PreviewNotice
      v-else-if="status === 'error'"
      tone="error"
      :title="unsupported ? t('preview.archive.unsupportedTitle') : t('preview.archive.errorTitle')"
      :detail="unsupported ? t('preview.archive.unsupportedDetail') : message"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton v-if="!unsupported" @click="load">{{ t("common.retry") }}</FluentButton>
    </PreviewNotice>
    <template v-else>
      <PreviewToolbar>
        <nav class="crumbs" :aria-label="t('preview.archive.location')">
          <button class="crumbs__item" :disabled="!inner.length" @click="inner = []">{{ file.name }}</button>
          <template v-for="(part, i) in inner" :key="i">
            <span class="crumbs__sep">/</span>
            <button class="crumbs__item" :disabled="i === inner.length - 1" @click="inner = inner.slice(0, i + 1)">{{ part }}</button>
          </template>
        </nav>
        <span class="spacer" />
        <FluentButton v-if="canExtract" :disabled="extracting" @click="extract">
          <FluentSvgIcon :svg="previewIcons.folderZip" :size="18" />
          {{ extracting ? t("preview.archive.extracting") : t("preview.archive.extract") }}
        </FluentButton>
      </PreviewToolbar>
      <p v-if="!entries.length" class="empty">{{ t("preview.archive.empty") }}</p>
      <ul v-else class="list">
        <li v-if="inner.length">
          <button class="row" @click="inner = inner.slice(0, -1)">
            <FluentSvgIcon :svg="previewIcons.folder" :size="20" />
            <span class="row__name">..</span>
          </button>
        </li>
        <li v-for="node in entries" :key="node.name">
          <button class="row" :disabled="!node.is_dir" @click="inner = [...inner, node.name]">
            <FluentSvgIcon :svg="node.is_dir ? previewIcons.folder : iconForEntry({ name: node.name, is_dir: false, type: node.type })" :size="20" />
            <span class="row__name">{{ node.name }}</span>
            <span class="row__meta">{{ node.is_dir ? "" : formatSize(node.size) }}</span>
            <span class="row__meta row__date">{{ formatDate(node.modified) }}</span>
          </button>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.crumbs__item {
  max-width: 220px;
  padding: 2px 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font: inherit;
  color: var(--fluent-accent-link);
  background: none;
  border: 0;
  border-radius: var(--fluent-radius);
  cursor: pointer;
}
.crumbs__item:disabled {
  color: var(--fluent-text);
  cursor: default;
}
.crumbs__sep {
  color: var(--fluent-muted);
}
.empty {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  color: var(--fluent-muted);
}
.list {
  margin: 0;
  padding: 0;
  max-height: 70dvh;
  overflow: auto;
  list-style: none;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 16px;
  text-align: start;
  font: inherit;
  color: var(--fluent-text);
  background: none;
  border: 0;
  border-bottom: 1px solid var(--fluent-border);
  cursor: pointer;
  transition: var(--motion-fill);
}
.row:disabled {
  cursor: default;
}
.row:not(:disabled):hover {
  background: var(--fluent-control-hover);
}
.row__name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.row__meta {
  flex: none;
  min-width: 5em;
  text-align: end;
  color: var(--fluent-muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
@media (max-width: 640px) {
  .row__date {
    display: none;
  }
}
</style>
