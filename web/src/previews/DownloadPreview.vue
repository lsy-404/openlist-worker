<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { notify } from "@/stores/toast"
import { absoluteUrl } from "@/utils/path"
import FileCard from "./FileCard.vue"
import { startDownload } from "./download"
import { previewIcons } from "./icons"
import { expandTemplate } from "./links"
import { schemesFor } from "./registry"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

const external = computed(() =>
  schemesFor("external_previews", props.file.name).map(({ label, template }) => ({
    label,
    href: expandTemplate(template, { downloadUrl: props.downloadUrl, name: props.file.name }),
  })),
)

function openExternal(href: string) {
  window.open(href, "_blank", "noopener")
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(absoluteUrl(props.downloadUrl))
    notify(t("preview.download.copied"), "success")
  } catch {
    notify(t("preview.download.copyFailed"), "danger")
  }
}
</script>

<template>
  <FileCard :file="file">
    <FluentButton tone="primary" @click="startDownload(downloadUrl, file.name)">
      <FluentSvgIcon :svg="previewIcons.arrowDownload" :size="18" />
      {{ t("preview.notice.download") }}
    </FluentButton>
    <FluentButton @click="copyLink">
      <FluentSvgIcon :svg="previewIcons.copy" :size="18" />
      {{ t("preview.download.copyLink") }}
    </FluentButton>
    <template v-if="external.length">
      <FluentButton v-for="item in external" :key="item.label" @click="openExternal(item.href)">
        <FluentSvgIcon :svg="previewIcons.open" :size="18" />
        {{ t("preview.download.openWith", { name: item.label }) }}
      </FluentButton>
    </template>
  </FileCard>
</template>
