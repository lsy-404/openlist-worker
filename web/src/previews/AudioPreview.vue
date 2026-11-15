<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { ref, watch } from "vue"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { proxyUrl } from "./download"
import SiblingNav from "./SiblingNav.vue"
import { previewIcons } from "./icons"
import { isAudio } from "./kinds"
import type { PreviewProps } from "./registry"
import { useSiblings } from "./useSiblings"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const failed = ref(false)
const nav = useSiblings(() => ({ path: props.path, related: props.file.related }), isAudio)

const src = ref(props.downloadUrl)
let triedProxy = false

watch(
  () => props.downloadUrl,
  (url) => {
    failed.value = false
    src.value = url
    triedProxy = false
  },
)

function onError() {
  const fallback = triedProxy ? null : proxyUrl(src.value)
  if (fallback) {
    triedProxy = true
    src.value = fallback
  } else {
    failed.value = true
  }
}
</script>

<template>
  <PreviewNotice
    v-if="failed"
    tone="error"
    :title="t('preview.audio.errorTitle')"
    :detail="t('preview.audio.errorDetail')"
    :download-url="downloadUrl"
    :filename="file.name"
  />
  <div v-else class="audio">
    <FluentSvgIcon :svg="previewIcons.musicNote" :size="56" />
    <audio :key="src" class="audio__player" :src="src" controls preload="metadata" @error="onError" />
    <SiblingNav v-bind="nav" @prev="nav.prev" @next="nav.next" />
  </div>
</template>

<style scoped>
.audio {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 16px;
  color: var(--fluent-muted);
}
.audio__player {
  width: min(100%, 560px);
}
</style>
