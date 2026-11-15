<script setup lang="ts">
import { ref } from "vue"
import { FluentButton, FluentMenu, FluentSvgIcon, type FluentMenuItem } from "@platform-kit/fluent/vue"
import { browseIcons } from "@/utils/icons"

withDefaults(
  defineProps<{
    icon: string
    label: string
    items: readonly FluentMenuItem[]
    modelValue?: string | readonly string[]
    text?: string
    chevron?: boolean
  }>(),
  { modelValue: undefined, text: undefined, chevron: false },
)
const emit = defineEmits<{ select: [value: string] }>()

const open = ref(false)
const anchor = ref<HTMLElement | null>(null)
</script>

<template>
  <span ref="anchor" class="menu-button">
    <FluentButton
      tone="subtle"
      :icon-only="!text && !chevron"
      :aria-label="label"
      :title="label"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <FluentSvgIcon :svg="icon" :size="20" />
      <template v-if="text">{{ text }}</template>
      <FluentSvgIcon v-if="chevron" :svg="browseIcons.chevronDown" :size="12" />
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
