<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { nextTick, ref, watch } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import BufferGate from "./BufferGate.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"
import { useFileBuffer } from "./useFileBuffer"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, buffer, error, load } = useFileBuffer(() => ({ url: props.downloadUrl, size: props.file.size }))

const scroller = ref<HTMLElement>()
const body = ref<HTMLElement>()
const styles = ref<HTMLElement>()
const failed = ref("")
const zoom = ref(1)

function fit() {
  const page = body.value?.querySelector<HTMLElement>("section.docx")
  const box = scroller.value
  if (!page || !box) return
  zoom.value = Math.min(1, (box.clientWidth - 24) / page.offsetWidth)
}

watch(buffer, async (data) => {
  failed.value = ""
  body.value?.replaceChildren()
  styles.value?.replaceChildren()
  if (!data) return
  await nextTick()
  try {
    const { renderAsync } = await import("docx-preview")
    await renderAsync(data, body.value!, styles.value!, { breakPages: true, ignoreLastRenderedPageBreak: true })
    fit()
  } catch (err) {
    failed.value = err instanceof Error ? err.message : String(err)
  }
})
</script>

<template>
  <div>
    <BufferGate
      v-if="status !== 'ready' || failed"
      :status="status"
      :error="error"
      :failed="failed"
      :size="file.size"
      :download-url="downloadUrl"
      :filename="file.name"
      @load="load"
    />
    <PreviewToolbar v-show="status === 'ready' && !failed">
      <span class="spacer" />
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomOut')" @click="zoom = Math.max(0.3, zoom / 1.2)">
        <FluentSvgIcon :svg="previewIcons.zoomOut" :size="18" />
      </FluentButton>
      <span class="hint zoom">{{ Math.round(zoom * 100) }}%</span>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomIn')" @click="zoom = Math.min(3, zoom * 1.2)">
        <FluentSvgIcon :svg="previewIcons.zoomIn" :size="18" />
      </FluentButton>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.pdf.fitWidth')" @click="fit">
        <FluentSvgIcon :svg="previewIcons.arrowReset" :size="18" />
      </FluentButton>
    </PreviewToolbar>
    <div v-show="status === 'ready' && !failed" ref="scroller" class="doc">
      <div ref="styles" />
      <div ref="body" class="doc__body" :style="{ zoom }" />
    </div>
  </div>
</template>

<style scoped>
.doc {
  max-height: 78dvh;
  overflow: auto;
  background: var(--fluent-control-alt);
}
.doc__body :deep(.docx-wrapper) {
  padding: 12px;
  background: transparent;
}
.doc__body :deep(.docx-wrapper > section.docx) {
  margin-bottom: 12px;
  box-shadow: 0 1px 6px rgb(0 0 0 / 25%);
}
.zoom {
  min-width: 3.5em;
  text-align: center;
}
</style>
