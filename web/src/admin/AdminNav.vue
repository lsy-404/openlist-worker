<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute } from "vue-router"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { isAdmin } from "@/stores/session"
import { icons } from "@/utils/icons"
import { useSlidingIndicator } from "@/utils/slidingIndicator"
import { adminPages } from "./registry"
import { adminGroups } from "./types"

const { t } = useI18n()
const route = useRoute()
const root = ref<HTMLElement | null>(null)
const bar = ref<HTMLElement | null>(null)
useSlidingIndicator(root, bar, ".nav__item--active", () => route.path)

const groups = computed(() =>
  adminGroups.map((id) => ({ id, pages: adminPages.filter((page) => page.group === id) })).filter((group) => group.pages.length),
)
</script>

<template>
  <nav v-if="isAdmin" ref="root" class="nav" :aria-label="t('admin.title')">
    <RouterLink to="/" class="nav__item nav__back">
      <FluentSvgIcon :svg="icons.arrowLeft" :size="18" />
      <span>{{ t("admin.back") }}</span>
    </RouterLink>
    <section v-for="group in groups" :key="group.id" class="nav__group">
      <h2 v-if="group.id !== 'home'" class="nav__heading">{{ t(`admin.groups.${group.id}`) }}</h2>
      <RouterLink
        v-for="page in group.pages"
        :key="page.path"
        :to="`/@manage/${page.path}`"
        class="nav__item"
        active-class="nav__item--active"
      >
        <FluentSvgIcon :svg="page.icon" :size="18" />
        <span>{{ t(page.title) }}</span>
      </RouterLink>
    </section>
    <span ref="bar" class="nav__bar" aria-hidden="true" />
  </nav>
</template>

<style scoped>
.nav {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.nav__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 12px;
}
.nav__heading {
  margin: 0;
  padding: 4px 12px;
  color: var(--fluent-muted);
  font-size: 0.75rem;
  font-weight: 600;
}
.nav__item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--fluent-radius);
  color: var(--fluent-text);
  text-decoration: none;
  transition: var(--motion-fill);
}
.nav__item:hover {
  background: var(--fluent-control-hover);
}
.nav__item:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.nav__item--active {
  background: var(--fluent-selection);
}
.nav__bar {
  position: absolute;
  inset-inline-start: 0;
  top: 0;
  width: 3px;
  height: 16px;
  border-radius: 2px;
  background: var(--fluent-accent);
  opacity: 0;
  pointer-events: none;
  transition:
    transform var(--fluent-normal) var(--motion-ease-move),
    opacity var(--fluent-fast) var(--fluent-ease);
}
.nav__back {
  margin-bottom: 4px;
}
</style>
