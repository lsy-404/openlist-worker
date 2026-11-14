<script setup lang="ts">
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

const props = defineProps<PreviewProps>()

const { status, text, encoding, error, load } = useTextFile(() => ({ url: props.downloadUrl, size: props.file.size }))
const markdown = computed(() => isMarkdown(props.file))
const mode = ref<"rendered" | "source">("rendered")
const wrap = ref(true)
const language = computed(() => languageFor(props.file.name))
const modes = [
  { value: "rendered", label: "预览" },
  { value: "source", label: "源码" },
]
const showRendered = computed(() => markdown.value && mode.value === "rendered")
</script>

<template>
  <div class="text">
    <PreviewNotice v-if="status === 'loading'" tone="loading" title="正在读取文件…" />
    <PreviewNotice
      v-else-if="status === 'large'"
      tone="info"
      title="文件较大，未自动加载"
      :detail="`文件大小 ${formatSize(file.size)}，直接加载可能较慢。`"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton tone="primary" @click="load(true)">仍然加载</FluentButton>
    </PreviewNotice>
    <PreviewNotice
      v-else-if="status === 'error'"
      tone="error"
      title="无法显示文件内容"
      :detail="error"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton @click="load(true)">重试</FluentButton>
    </PreviewNotice>
    <template v-else>
      <PreviewToolbar>
        <FluentSegmented v-if="markdown" v-model="mode" :options="modes" label="显示方式" />
        <span class="spacer" />
        <span class="hint">{{ encoding }}</span>
        <FluentToggleButton v-if="!showRendered" v-model="wrap" tone="subtle">
          <FluentSvgIcon :svg="previewIcons.textWrap" :size="18" />
          自动换行
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
