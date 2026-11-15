<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, ref } from "vue"
import { FluentSegmented, FluentSelect } from "@platform-kit/fluent/vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { findViewers, viewerLabel } from "./registry"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

const viewers = computed(() => findViewers(props.file))
const chosen = ref("")
const current = computed(() => viewers.value.find((v) => v.key === chosen.value) ?? viewers.value[0])
const options = computed(() => viewers.value.map((v) => ({ value: v.key, label: viewerLabel(v) })))
const compact = computed(() => options.value.length > 4)
</script>

<template>
  <div class="host">
    <PreviewToolbar v-if="viewers.length > 1" class="host__bar">
      <FluentSelect v-if="compact" :model-value="current.key" :options="options" :label="t('preview.viewerLabel')" @update:model-value="chosen = $event" />
      <FluentSegmented v-else :model-value="current.key" :options="options" :label="t('preview.viewerLabel')" @update:model-value="chosen = String($event)" />
    </PreviewToolbar>
    <component
      :is="current.component"
      :key="current.key"
      v-bind="{ ...current.props, file, path, downloadUrl }"
    />
  </div>
</template>
