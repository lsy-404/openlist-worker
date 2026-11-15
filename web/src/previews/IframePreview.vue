<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { previewIcons } from "./icons"
import { expandTemplate } from "./links"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps & { template: string }>()
const src = computed(() => expandTemplate(props.template, { downloadUrl: props.downloadUrl, name: props.file.name }))

function openTab() {
  window.open(src.value, "_blank", "noopener")
}
</script>

<template>
  <div>
    <PreviewToolbar>
      <span class="spacer" />
      <FluentButton tone="subtle" @click="openTab">
        <FluentSvgIcon :svg="previewIcons.open" :size="18" />
        {{ t("preview.iframe.openTab") }}
      </FluentButton>
    </PreviewToolbar>
    <iframe
      class="frame"
      :src="src"
      :title="file.name"
      sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      referrerpolicy="no-referrer"
      loading="lazy"
    />
  </div>
</template>

<style scoped>
.frame {
  display: block;
  width: 100%;
  height: clamp(320px, 75vh, 900px);
  border: 0;
  background: #fff;
}
</style>
