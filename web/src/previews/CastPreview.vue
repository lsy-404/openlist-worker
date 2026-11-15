<script setup lang="ts">
import "asciinema-player/dist/bundle/asciinema-player.css"
import { useI18n } from "vue-i18n"
import { nextTick, onBeforeUnmount, ref, watch } from "vue"
import PreviewNotice from "./PreviewNotice.vue"
import { fetchFile } from "./fetch"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const box = ref<HTMLElement>()
const failed = ref(false)
let player: { dispose(): void } | null = null

async function start() {
  player?.dispose()
  player = null
  failed.value = false
  await nextTick()
  if (!box.value) return
  try {
    const { create } = await import("asciinema-player")
    const data = await (await fetchFile(props.downloadUrl)).text()
    if (!box.value) return
    player = create({ data }, box.value, { fit: "width", theme: "asciinema" })
  } catch {
    failed.value = true
  }
}

watch(() => props.downloadUrl, () => void start(), { immediate: true })
onBeforeUnmount(() => player?.dispose())
</script>

<template>
  <div>
    <PreviewNotice
      v-if="failed"
      tone="error"
      :title="t('preview.cast.errorTitle')"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <div v-show="!failed" ref="box" class="cast" />
  </div>
</template>

<style scoped>
.cast {
  padding: 12px;
  background: #121314;
}
</style>
