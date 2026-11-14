<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"

const props = defineProps<{ title?: string; description?: string }>()

const { t } = useI18n()
const route = useRoute()
const heading = computed(() => props.title ?? (route.meta.title ? t(route.meta.title) : ""))
</script>

<template>
  <section class="page">
    <header class="page__head">
      <h1 class="page__title">{{ heading }}</h1>
      <p v-if="description" class="page__desc">{{ description }}</p>
    </header>
    <div v-if="$slots.actions" class="page__actions" role="toolbar"><slot name="actions" /></div>
    <div class="page__body"><slot /></div>
  </section>
</template>

<style scoped>
.page {
  box-sizing: border-box;
  max-width: 1000px;
  padding: 24px 32px 32px;
}
.page__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
}
.page__desc {
  margin: 4px 0 0;
  color: var(--fluent-muted);
}
.page__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--fluent-border);
}
.page__body {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .page {
    padding: 16px;
  }
  .page__title {
    font-size: 1.4rem;
  }
}
</style>
