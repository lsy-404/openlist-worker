<script setup lang="ts">
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"

const props = defineProps<PreviewProps>()

function openViewer() {
  window.open(props.downloadUrl, "_blank", "noopener")
}
</script>

<template>
  <PreviewNotice
    tone="info"
    title="PDF 文档"
    detail="站点禁止页面内嵌入文档，请在新标签页中使用浏览器自带的 PDF 查看器打开。"
    :download-url="downloadUrl"
    :filename="file.name"
  >
    <FluentButton tone="primary" @click="openViewer">
      <FluentSvgIcon :svg="previewIcons.open" :size="18" />
      在新标签页打开
    </FluentButton>
  </PreviewNotice>
</template>
