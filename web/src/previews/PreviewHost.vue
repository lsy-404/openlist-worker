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
    <Transition name="viewer" mode="out-in">
      <div :key="current.key">
        <component :is="current.component" v-bind="{ ...current.props, file, path, downloadUrl }" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.viewer-enter-active {
  transition:
    opacity var(--fluent-normal) var(--fluent-ease),
    transform var(--fluent-normal) var(--fluent-ease);
}
.viewer-leave-active {
  transition: opacity var(--fluent-faster) var(--fluent-ease-accelerate);
}
.viewer-enter-from {
  opacity: 0;
  transform: translateY(var(--motion-rise));
}
.viewer-leave-to {
  opacity: 0;
}
</style>
