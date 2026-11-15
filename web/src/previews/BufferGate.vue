<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton } from "@platform-kit/fluent/vue"
import { formatSize } from "@/utils/format"
import PreviewNotice from "./PreviewNotice.vue"
import type { BufferStatus } from "./useFileBuffer"

const { t } = useI18n()
defineProps<{ status: BufferStatus; error: string; size: number; downloadUrl: string; filename: string; failed?: string }>()
defineEmits<{ load: [force: boolean] }>()
</script>

<template>
  <PreviewNotice v-if="status === 'loading'" tone="loading" :title="t('preview.text.reading')" />
  <PreviewNotice
    v-else-if="status === 'large'"
    tone="info"
    :title="t('preview.text.largeTitle')"
    :detail="t('preview.text.largeDetail', { size: formatSize(size) })"
    :download-url="downloadUrl"
    :filename="filename"
  >
    <FluentButton tone="primary" @click="$emit('load', true)">{{ t("preview.text.loadAnyway") }}</FluentButton>
  </PreviewNotice>
  <PreviewNotice
    v-else-if="status === 'error' || failed"
    tone="error"
    :title="t('preview.office.errorTitle')"
    :detail="failed || error"
    :download-url="downloadUrl"
    :filename="filename"
  >
    <FluentButton @click="$emit('load', true)">{{ t("common.retry") }}</FluentButton>
  </PreviewNotice>
</template>
