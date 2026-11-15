<script setup lang="ts">
import { nextTick, ref, watch } from "vue"
import BufferGate from "./BufferGate.vue"
import type { PreviewProps } from "./registry"
import { useFileBuffer } from "./useFileBuffer"

const props = defineProps<PreviewProps>()
const { status, buffer, error, load } = useFileBuffer(() => ({ url: props.downloadUrl, size: props.file.size }))

const box = ref<HTMLElement>()
const failed = ref("")

watch(buffer, async (data) => {
  failed.value = ""
  box.value?.replaceChildren()
  if (!data || !box.value) return
  await nextTick()
  try {
    const { init } = await import("pptx-preview")
    const width = Math.max(280, Math.min(1000, box.value.clientWidth - 24))
    const viewer = init(box.value, { width, height: Math.round((width * 9) / 16), mode: "list" })
    await viewer.preview(data)
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
    <div v-show="status === 'ready' && !failed" ref="box" class="slides" />
  </div>
</template>

<style scoped>
.slides {
  max-height: 78vh;
  overflow: auto;
  padding: 12px;
  background: var(--fluent-control-alt);
}
</style>
