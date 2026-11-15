<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton } from "@platform-kit/fluent/vue"
import { formatSize } from "@/utils/format"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import type { PreviewProps } from "./registry"
import { useTextFile } from "./useTextFile"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, text, encoding, error, load } = useTextFile(() => ({ url: props.downloadUrl, size: props.file.size }))
</script>

<template>
  <div>
    <PreviewNotice v-if="status === 'loading'" tone="loading" :title="t('preview.text.reading')" />
    <PreviewNotice
      v-else-if="status === 'large'"
      tone="info"
      :title="t('preview.text.largeTitle')"
      :detail="t('preview.text.largeDetail', { size: formatSize(file.size) })"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton tone="primary" @click="load(true)">{{ t("preview.text.loadAnyway") }}</FluentButton>
    </PreviewNotice>
    <PreviewNotice
      v-else-if="status === 'error'"
      tone="error"
      :title="t('preview.text.errorTitle')"
      :detail="error"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton @click="load(true)">{{ t("common.retry") }}</FluentButton>
    </PreviewNotice>
    <template v-else>
      <PreviewToolbar>
        <span class="hint">{{ t("preview.html.sandboxed") }}</span>
        <span class="spacer" />
        <span class="hint">{{ encoding }}</span>
      </PreviewToolbar>
      <iframe class="frame" :srcdoc="text" :title="file.name" sandbox="" referrerpolicy="no-referrer" />
    </template>
  </div>
</template>

<style scoped>
.frame {
  display: block;
  width: 100%;
  height: clamp(320px, 75vh, 900px);
  border: 0;
  background: #fff;
}
</style>
