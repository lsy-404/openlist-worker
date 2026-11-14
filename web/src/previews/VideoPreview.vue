<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { ref, watch } from "vue"
import { FluentProgressRing } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { proxyUrl } from "./download"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
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
      ? t("preview.video.unsupported")
      : code === MediaError.MEDIA_ERR_NETWORK
        ? t("preview.video.network")
        : t("preview.video.generic")
  status.value = "error"
}
</script>

<template>
  <div class="video">
    <PreviewNotice
      v-if="status === 'error'"
      tone="error"
      :title="t('preview.video.errorTitle')"
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
        <FluentProgressRing indeterminate :size="32" :label="t('common.loading')" />
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
