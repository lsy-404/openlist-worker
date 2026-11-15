<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import Breadcrumb from "@/components/Breadcrumb.vue"
import FolderFilter from "@/search/FolderFilter.vue"
import { canGoBack, canGoForward, goBack, goForward } from "@/tabs/store"
import { browseIcons, icons } from "@/utils/icons"
import CommandBar from "./CommandBar.vue"
import type { Commands } from "./commands"

const props = defineProps<{ path: string; commands: Commands | null; filterable: boolean; loading: boolean }>()
const emit = defineEmits<{ up: []; refresh: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="toolbar">
    <div class="toolbar__nav">
      <div class="toolbar__buttons">
        <FluentButton tone="subtle" icon-only :disabled="!canGoBack" :aria-label="t('explorer.nav.back')" :title="t('explorer.nav.back')" @click="goBack">
          <FluentSvgIcon :svg="icons.arrowLeft" :size="20" />
        </FluentButton>
        <FluentButton tone="subtle" icon-only :disabled="!canGoForward" :aria-label="t('explorer.nav.forward')" :title="t('explorer.nav.forward')" @click="goForward">
          <FluentSvgIcon :svg="browseIcons.arrowRight" :size="20" />
        </FluentButton>
        <FluentButton tone="subtle" icon-only :disabled="path === '/'" :aria-label="t('explorer.nav.up')" :title="t('explorer.nav.up')" @click="emit('up')">
          <FluentSvgIcon :svg="icons.arrowUp" :size="20" />
        </FluentButton>
        <FluentButton tone="subtle" icon-only :busy="loading" :aria-label="t('explorer.nav.refresh')" :title="t('explorer.nav.refresh')" @click="emit('refresh')">
          <FluentSvgIcon v-if="!loading" :svg="icons.arrowClockwise" :size="20" />
        </FluentButton>
      </div>
      <Breadcrumb :path="path" />
      <FolderFilter v-if="filterable" class="toolbar__filter" />
    </div>
    <CommandBar v-if="commands" :commands="commands" />
  </div>
</template>

<style scoped>
.toolbar__nav {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 8px 4px;
}
.toolbar__buttons {
  display: flex;
  gap: 2px;
}
.toolbar__nav :deep(.address) {
  flex: 1 1 200px;
}
.toolbar__filter {
  flex: 0 1 220px;
}
@media (max-width: 640px) {
  .toolbar__nav :deep(.address) {
    flex: 1 1 0;
  }
}
</style>
