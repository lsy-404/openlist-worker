<script setup lang="ts">
import { FluentButton, FluentProgressRing, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { icons } from "@/utils/icons"
import { previewIcons } from "./icons"
import { startDownload } from "./download"

defineProps<{
  tone: "loading" | "error" | "info"
  title: string
  detail?: string
  downloadUrl?: string
  filename?: string
}>()
</script>

<template>
  <div class="notice" :role="tone === 'error' ? 'alert' : 'status'">
    <FluentProgressRing v-if="tone === 'loading'" indeterminate :size="32" label="加载中" />
    <FluentSvgIcon v-else :svg="tone === 'error' ? icons.warning : icons.document" :size="40" />
    <p class="notice__title">{{ title }}</p>
    <p v-if="detail" class="notice__detail">{{ detail }}</p>
    <div class="notice__actions">
      <slot />
      <FluentButton v-if="downloadUrl" @click="startDownload(downloadUrl, filename ?? '')">
        <FluentSvgIcon :svg="previewIcons.arrowDownload" :size="18" />
        下载文件
      </FluentButton>
    </div>
  </div>
</template>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  color: var(--fluent-muted);
}
.notice p {
  margin: 0;
}
.notice__title {
  color: var(--fluent-text);
  font-weight: 600;
}
.notice__detail {
  max-width: 520px;
  overflow-wrap: anywhere;
}
.notice__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.notice__actions:empty {
  display: none;
}
</style>
