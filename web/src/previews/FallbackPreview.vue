<script setup lang="ts">
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { iconForEntry } from "@/utils/icons"
import type { PreviewProps } from "./registry"

const props = defineProps<PreviewProps>()
</script>

<template>
  <div class="fallback">
    <FluentSvgIcon :svg="iconForEntry(props.file)" :size="56" />
    <p>此类型的文件暂不支持在线预览</p>
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
