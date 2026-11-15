<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { notify } from "@/stores/toast"
import FileCard from "./FileCard.vue"
import PreviewNotice from "./PreviewNotice.vue"
import { previewIcons } from "./icons"
import { isWebUrl } from "./links"
import type { PreviewProps } from "./registry"
import { useTextFile } from "./useTextFile"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, text } = useTextFile(() => ({ url: props.downloadUrl, size: props.file.size }))

const target = computed(() => {
  const match = /^\s*URL\s*=\s*(.+?)\s*$/im.exec(text.value)
  return match && isWebUrl(match[1]) ? match[1] : ""
})

async function copy() {
  try {
    await navigator.clipboard.writeText(target.value)
    notify(t("preview.download.copied"), "success")
  } catch {
    notify(t("preview.download.copyFailed"), "danger")
  }
}
</script>

<template>
  <PreviewNotice v-if="status === 'loading'" tone="loading" :title="t('preview.text.reading')" />
  <PreviewNotice
    v-else-if="status !== 'ready' || !target"
    tone="error"
    :title="t('preview.url.invalid')"
    :download-url="downloadUrl"
    :filename="file.name"
  />
  <FileCard v-else :file="file">
    <p class="target">{{ target }}</p>
    <template #after>
      <div class="actions">
        <a class="open" :href="target" target="_blank" rel="noopener noreferrer">
          <FluentButton tone="primary" tabindex="-1">
            <FluentSvgIcon :svg="previewIcons.open" :size="18" />
            {{ t("preview.url.open") }}
          </FluentButton>
        </a>
        <FluentButton @click="copy">
          <FluentSvgIcon :svg="previewIcons.copy" :size="18" />
          {{ t("preview.download.copyLink") }}
        </FluentButton>
      </div>
    </template>
  </FileCard>
</template>

<style scoped>
.target {
  max-width: 520px;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
}
.open {
  text-decoration: none;
}
</style>
