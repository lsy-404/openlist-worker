<script setup lang="ts">
import { computed } from "vue"
import { renderMarkdown } from "@/utils/markdown"

const props = defineProps<{ source: string }>()
const html = computed(() => renderMarkdown(props.source))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify -->
  <article class="markdown" v-html="html" />
</template>

<style>
.markdown {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.markdown > :first-child {
  margin-top: 0;
}
.markdown > :last-child {
  margin-bottom: 0;
}
.markdown h1,
.markdown h2,
.markdown h3,
.markdown h4 {
  line-height: 1.3;
  margin: 1.4em 0 0.6em;
  font-weight: 600;
}
.markdown h1 {
  font-size: 1.5rem;
}
.markdown h2 {
  font-size: 1.25rem;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--fluent-border);
}
.markdown h3 {
  font-size: 1.1rem;
}
.markdown a {
  color: var(--fluent-accent-link);
}
.markdown img {
  max-width: 100%;
  height: auto;
  border-radius: var(--fluent-radius);
}
.markdown code {
  font-family: "Cascadia Mono", Consolas, ui-monospace, monospace;
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-alt);
}
.markdown pre {
  overflow-x: auto;
  padding: 12px 14px;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-alt);
  border: 1px solid var(--fluent-border);
}
.markdown pre code {
  padding: 0;
  background: none;
}
.markdown blockquote {
  margin: 1em 0;
  padding: 0 1em;
  color: var(--fluent-muted);
  border-inline-start: 3px solid var(--fluent-border);
}
.markdown table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}
.markdown th,
.markdown td {
  padding: 6px 12px;
  border: 1px solid var(--fluent-border);
}
.markdown hr {
  border: 0;
  border-top: 1px solid var(--fluent-border);
}
</style>
