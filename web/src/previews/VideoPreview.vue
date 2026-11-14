<script setup lang="ts">
import { ref, watch } from "vue"
import { FluentProgressRing } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { proxyUrl } from "./download"
import type { PreviewProps } from "./registry"

const props = defineProps<PreviewProps>()
const video = ref<HTMLVideoElement>()
const status = ref<"loading" | "ready" | "error">("loading")
const detail = ref("")
const src = ref(props.downloadUrl)
let triedProxy = false

watch(
  () => props.downloadUrl,
  (url) => {
    status.value = "loading"
    src.value = url
    triedProxy = false
  },
)

function onError() {
  const fallback = triedProxy ? null : proxyUrl(src.value)
  if (fallback) {
    triedProxy = true
    src.value = fallback
    return
  }
  const code = video.value?.error?.code
  detail.value =
    code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? "当前浏览器无法播放此视频的封装或编码格式，可以下载后用本地播放器观看。"
      : code === MediaError.MEDIA_ERR_NETWORK
        ? "网络错误，视频未能加载。"
        : "视频无法播放。"
  status.value = "error"
}
</script>

<template>
  <div class="video">
    <PreviewNotice
      v-if="status === 'error'"
      tone="error"
      title="无法播放视频"
      :detail="detail"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <div v-show="status !== 'error'" class="video__frame">
      <video
        :key="src"
        ref="video"
        class="video__player"
        :src="src"
        controls
        playsinline
        preload="metadata"
        @loadedmetadata="status = 'ready'"
        @error="onError"
      />
      <div v-if="status === 'loading'" class="video__loading">
        <FluentProgressRing indeterminate :size="32" label="加载中" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.video__frame {
  position: relative;
  background: #000;
}
.video__player {
  display: block;
  width: 100%;
  max-height: 78vh;
  min-height: 180px;
}
.video__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
</style>
