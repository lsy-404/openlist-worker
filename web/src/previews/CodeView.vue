<script setup lang="ts">
import { ref, watch } from "vue"
import { highlightCode } from "./highlight"

const props = defineProps<{ text: string; language: string | null; wrap: boolean }>()
const html = ref<string | null>(null)

watch(
  () => [props.text, props.language] as const,
  async ([text, language]) => {
    html.value = null
    if (!language) return
    const result = await highlightCode(text, language).catch(() => null)
    if (text === props.text && language === props.language) html.value = result
  },
  { immediate: true },
)
</script>

<template>
  <pre class="code" :class="{ 'code--wrap': wrap }" tabindex="0"><!-- eslint-disable-next-line vue/no-v-html --><code v-if="html !== null" v-html="html" /><code v-else>{{ text }}</code></pre>
</template>

<style scoped>
.code {
  --tok-keyword: #0f5fb8;
  --tok-string: #a3320b;
  --tok-number: #0b7a4b;
  --tok-comment: #6b7280;
  --tok-title: #7a3e9d;
  --tok-attr: #0b6a8a;
  margin: 0;
  padding: 12px 14px;
  max-height: 75vh;
  overflow: auto;
  font: 13px/1.6 "Cascadia Mono", Consolas, ui-monospace, monospace;
  tab-size: 4;
  white-space: pre;
  color: var(--fluent-text);
  background: var(--fluent-control-alt);
}
:global([data-fluent-theme="dark"]) .code {
  --tok-keyword: #6cb6ff;
  --tok-string: #f2a579;
  --tok-number: #7fd6a0;
  --tok-comment: #8b95a5;
  --tok-title: #d2a8ff;
  --tok-attr: #79c0d8;
}
.code--wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.code :deep(.hljs-keyword),
.code :deep(.hljs-built_in),
.code :deep(.hljs-literal),
.code :deep(.hljs-selector-tag),
.code :deep(.hljs-doctag),
.code :deep(.hljs-meta .hljs-keyword) {
  color: var(--tok-keyword);
}
.code :deep(.hljs-string),
.code :deep(.hljs-regexp),
.code :deep(.hljs-meta .hljs-string),
.code :deep(.hljs-addition) {
  color: var(--tok-string);
}
.code :deep(.hljs-number),
.code :deep(.hljs-symbol),
.code :deep(.hljs-bullet) {
  color: var(--tok-number);
}
.code :deep(.hljs-comment),
.code :deep(.hljs-quote),
.code :deep(.hljs-deletion) {
  color: var(--tok-comment);
  font-style: italic;
}
.code :deep(.hljs-title),
.code :deep(.hljs-section),
.code :deep(.hljs-type),
.code :deep(.hljs-class .hljs-title) {
  color: var(--tok-title);
}
.code :deep(.hljs-attr),
.code :deep(.hljs-attribute),
.code :deep(.hljs-name),
.code :deep(.hljs-variable),
.code :deep(.hljs-params),
.code :deep(.hljs-selector-class),
.code :deep(.hljs-selector-id),
.code :deep(.hljs-meta) {
  color: var(--tok-attr);
}
.code :deep(.hljs-strong) {
  font-weight: 700;
}
.code :deep(.hljs-emphasis) {
  font-style: italic;
}
</style>
