<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, ref } from "vue"
import { FluentButton, FluentSegmented, FluentSvgIcon, FluentToggleButton } from "@platform-kit/fluent/vue"
import MarkdownView from "@/components/MarkdownView.vue"
import { formatSize } from "@/utils/format"
import CodeView from "./CodeView.vue"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { languageFor } from "./highlight"
import { previewIcons } from "./icons"
import { isMarkdown } from "./kinds"
import type { PreviewProps } from "./registry"
import { useTextFile } from "./useTextFile"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

const { status, text, encoding, error, load } = useTextFile(() => ({ url: props.downloadUrl, size: props.file.size }))
const markdown = computed(() => isMarkdown(props.file))
const mode = ref<"rendered" | "source">("rendered")
const wrap = ref(true)
const language = computed(() => languageFor(props.file.name))
const modes = computed(() => [
  { value: "rendered", label: t("preview.text.rendered") },
  { value: "source", label: t("preview.text.source") },
])
const showRendered = computed(() => markdown.value && mode.value === "rendered")
</script>

<template>
  <div class="text">
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
        <FluentSegmented v-if="markdown" v-model="mode" :options="modes" :label="t('preview.text.modeLabel')" />
        <span class="spacer" />
        <span class="hint">{{ encoding }}</span>
        <FluentToggleButton v-if="!showRendered" v-model="wrap" tone="subtle">
          <FluentSvgIcon :svg="previewIcons.textWrap" :size="18" />
          {{ t("preview.text.wrap") }}
        </FluentToggleButton>
      </PreviewToolbar>
      <div v-if="showRendered" class="text__markdown"><MarkdownView :source="text" /></div>
      <CodeView v-else :text="text" :language="language" :wrap="wrap" />
    </template>
  </div>
</template>

<style scoped>
.text__markdown {
  padding: 16px 20px;
  max-height: 80vh;
  overflow: auto;
}
</style>
