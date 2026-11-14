<script setup lang="ts">
import { ref } from "vue"
import { FluentButton, FluentMenu, FluentSvgIcon, type FluentMenuItem } from "@platform-kit/fluent/vue"

withDefaults(
  defineProps<{
    icon: string
    label: string
    items: readonly FluentMenuItem[]
    modelValue?: string
    text?: string
  }>(),
  { modelValue: undefined, text: undefined },
)
const emit = defineEmits<{ select: [value: string] }>()

const open = ref(false)
const anchor = ref<HTMLElement | null>(null)
</script>

<template>
  <span ref="anchor" class="menu-button">
    <FluentButton
      tone="subtle"
      :icon-only="!text"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <FluentSvgIcon :svg="icon" :size="20" />
      <template v-if="text">{{ text }}</template>
    </FluentButton>
    <FluentMenu
      v-model:open="open"
      :label="label"
      :anchor="anchor"
      :items="items"
      :model-value="modelValue"
      @select="(value: string) => emit('select', value)"
    />
  </span>
</template>

<style scoped>
.menu-button {
  display: inline-flex;
}
</style>
