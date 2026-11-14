<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed } from "vue"
import { RouterLink } from "vue-router"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { icons } from "@/utils/icons"
import { encodePath, splitPath } from "@/utils/path"

const { t } = useI18n()
const props = defineProps<{ path: string }>()

const crumbs = computed(() => {
  const parts = splitPath(props.path)
  return parts.map((name, i) => ({ name, to: encodePath(parts.slice(0, i + 1).join("/")) }))
})
</script>

<template>
  <nav class="crumbs" :aria-label="t('browse.breadcrumb.label')">
    <ol>
      <li>
        <RouterLink to="/" class="crumb crumb--home" :title="t('browse.breadcrumb.root')" :aria-label="t('browse.breadcrumb.root')">
          <FluentSvgIcon :svg="icons.home" :size="18" />
        </RouterLink>
      </li>
      <li v-for="(crumb, i) in crumbs" :key="crumb.to">
        <FluentSvgIcon class="sep" :svg="icons.chevronRight" :size="12" />
        <span v-if="i === crumbs.length - 1" class="crumb crumb--current" aria-current="page">{{ crumb.name }}</span>
        <RouterLink v-else :to="crumb.to" class="crumb">{{ crumb.name }}</RouterLink>
      </li>
    </ol>
  </nav>
</template>

<style scoped>
.crumbs {
  overflow-x: auto;
  scrollbar-width: none;
}
.crumbs::-webkit-scrollbar {
  display: none;
}
ol {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  white-space: nowrap;
}
li {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.sep {
  color: var(--fluent-muted);
}
.crumb {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 8px;
  border-radius: var(--fluent-radius);
  color: var(--fluent-text);
  text-decoration: none;
}
a.crumb:hover {
  background: var(--fluent-control-hover);
}
a.crumb:active {
  background: var(--fluent-control-pressed);
}
a.crumb:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.crumb--current {
  font-weight: 600;
}
</style>
