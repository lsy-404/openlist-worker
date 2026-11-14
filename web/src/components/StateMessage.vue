<script setup lang="ts">
import { FluentSvgIcon } from "@platform-kit/fluent/vue"

defineProps<{ icon: string; title: string; detail?: string }>()
</script>

<template>
  <div class="state" role="status">
    <FluentSvgIcon :svg="icon" :size="48" />
    <h2>{{ title }}</h2>
    <p v-if="detail">{{ detail }}</p>
    <div class="state__actions"><slot /></div>
  </div>
</template>

<style scoped>
.state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 56px 16px;
  color: var(--fluent-muted);
}
h2 {
  margin: 8px 0 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--fluent-text);
}
p {
  margin: 0;
  max-width: 460px;
  overflow-wrap: anywhere;
}
.state__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.state__actions:empty {
  display: none;
}
</style>
