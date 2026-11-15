<script setup lang="ts">
import "@egjs/view360/css/view360.min.css"
import { useI18n } from "vue-i18n"
import { onBeforeUnmount, onMounted, ref, watch } from "vue"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import SiblingNav from "./SiblingNav.vue"
import { reachableUrl } from "./fetch"
import { isVideo } from "./kinds"
import type { PreviewProps } from "./registry"
import { settingFlag } from "./settings"
import { useSiblings } from "./useSiblings"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const nav = useSiblings(() => ({ path: props.path, related: props.file.related }), isVideo)

const container = ref<HTMLElement>()
const video = ref<HTMLVideoElement>()
const failed = ref(false)
let viewer: { destroy(): void } | null = null

async function start() {
  viewer?.destroy()
  viewer = null
  failed.value = false
  const el = video.value
  const host = container.value
  if (!el || !host) return
  try {
    const { default: View360, ControlBar, EquirectProjection } = await import("@egjs/view360")
    // The texture upload needs an address the page may read
    el.src = await reachableUrl(props.downloadUrl)
    viewer = new View360(host, {
      projection: new EquirectProjection({ src: el, video: { autoplay: settingFlag("video_autoplay") } }),
      plugins: [new ControlBar({ pieView: { order: 0 }, gyroButton: { position: "top-right", order: 1 }, vrButton: { position: "top-right", order: 2 } })],
    })
  } catch {
    failed.value = true
  }
}

watch(() => props.downloadUrl, () => void start())
onMounted(() => void start())
onBeforeUnmount(() => viewer?.destroy())
</script>

<template>
  <div>
    <PreviewToolbar>
      <SiblingNav :nav="nav" />
      <span class="spacer" />
      <span class="hint">{{ t("preview.video360.hint") }}</span>
    </PreviewToolbar>
    <PreviewNotice
      v-if="failed"
      tone="error"
      :title="t('preview.video.errorTitle')"
      :detail="t('preview.video360.unsupported')"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <div v-show="!failed" ref="container" class="view360-container stage">
      <canvas class="view360-canvas" />
      <video ref="video" class="stage__video" crossorigin="anonymous" playsinline />
    </div>
  </div>
</template>

<style scoped>
.stage {
  height: clamp(280px, 70dvh, 800px);
  background: #000;
}
.stage__video {
  display: none;
}
</style>
