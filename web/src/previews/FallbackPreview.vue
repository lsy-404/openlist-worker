<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { iconForEntry } from "@/utils/icons"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
</script>

<template>
  <div class="fallback">
    <FluentSvgIcon :svg="iconForEntry(props.file)" :size="56" />
    <p>{{ t("preview.fallback") }}</p>
  </div>
</template>

<style scoped>
.fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 16px;
  color: var(--fluent-muted);
}
p {
  margin: 0;
}
</style>
