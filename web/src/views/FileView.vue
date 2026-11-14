<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { createActionContext } from "@/actions/context"
import type { FsFile } from "@/api"
import ActionBar from "@/components/ActionBar.vue"
import FallbackPreview from "@/previews/FallbackPreview.vue"
import { findPreview } from "@/previews"
import { formatDate, formatSize } from "@/utils/format"
import { iconForEntry } from "@/utils/icons"
import { entryDownloadUrl } from "@/utils/links"
import { encodePath } from "@/utils/path"

const props = defineProps<{ path: string; file: FsFile }>()
const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

const downloadUrl = computed(() => props.file.raw_url || entryDownloadUrl(props.path, props.file.sign))
const preview = computed(() => findPreview(props.file))
const ctx = computed(() =>
  createActionContext(
    { surface: "toolbar", kind: "file", path: props.path, entry: props.file, downloadUrl: downloadUrl.value },
    { refresh: () => emit("refresh"), navigate: (p) => router.push(encodePath(p)) },
  ),
)
</script>

<template>
  <section class="file">
    <div class="panel summary">
      <FluentSvgIcon class="summary__icon" :svg="iconForEntry(file)" :size="48" />
      <div class="summary__body">
        <h1 class="summary__name">{{ file.name }}</h1>
        <dl class="summary__meta">
          <div>
            <dt>大小</dt>
            <dd>{{ formatSize(file.size) }}</dd>
          </div>
          <div>
            <dt>修改时间</dt>
            <dd>{{ formatDate(file.modified) }}</dd>
          </div>
        </dl>
      </div>
      <ActionBar class="summary__actions" :ctx="ctx" />
    </div>

    <div class="panel preview">
      <component
        :is="preview ? preview.component : FallbackPreview"
        :file="file"
        :path="path"
        :download-url="downloadUrl"
      />
    </div>
  </section>
</template>

<style scoped>
.file {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.panel {
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
}
.summary {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  padding: 20px;
}
.summary__icon {
  flex: none;
}
.summary__body {
  flex: 1;
  min-width: min(100%, 220px);
}
.summary__name {
  margin: 0 0 6px;
  font-size: 1.25rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.summary__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 24px;
  margin: 0;
  color: var(--fluent-muted);
}
.summary__meta div {
  display: flex;
  gap: 6px;
}
.summary__meta dt::after {
  content: "：";
}
.summary__meta dd {
  margin: 0;
  color: var(--fluent-text);
}
.preview {
  min-height: 160px;
  overflow: hidden;
}
</style>
