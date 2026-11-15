<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

function openViewer() {
  window.open(props.downloadUrl, "_blank", "noopener")
}
</script>

<template>
  <PreviewNotice
    tone="info"
    :title="t('preview.pdf.title')"
    :detail="t('preview.pdf.detail')"
    :download-url="downloadUrl"
    :filename="file.name"
  >
    <FluentButton tone="primary" @click="openViewer">
      <FluentSvgIcon :svg="previewIcons.open" :size="18" />
      {{ t("preview.pdf.open") }}
    </FluentButton>
  </PreviewNotice>
</template>
