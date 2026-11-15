<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { absoluteUrl } from "@/utils/path"
import FileCard from "./FileCard.vue"
import { startDownload } from "./download"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps & { kind: "plist" | "ipa" }>()

const link = computed(() => absoluteUrl(props.downloadUrl))
const installUrl = computed(() =>
  props.kind === "plist"
    ? `itms-services://?action=download-manifest&url=${link.value}`
    : `apple-magnifier://install?url=${encodeURIComponent(link.value)}`,
)

function install() {
  location.href = installUrl.value
}
</script>

<template>
  <FileCard :file="file">
    <FluentButton tone="primary" @click="install">
      <FluentSvgIcon :svg="previewIcons.arrowDownload" :size="18" />
      {{ t(kind === "plist" ? "preview.install.plist" : "preview.install.ipa") }}
    </FluentButton>
    <FluentButton @click="startDownload(downloadUrl, file.name)">{{ t("preview.notice.download") }}</FluentButton>
    <template #after>
      <p class="note">{{ t(kind === "plist" ? "preview.install.plistNote" : "preview.install.ipaNote") }}</p>
    </template>
  </FileCard>
</template>

<style scoped>
.note {
  max-width: 480px;
  margin: 0;
  font-size: 0.85rem;
}
</style>
