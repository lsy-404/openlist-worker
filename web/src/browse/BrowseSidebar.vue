<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute } from "vue-router"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { prefs } from "@/stores/prefs"
import { session } from "@/stores/session"
import { icons } from "@/utils/icons"
import { normalizePath } from "@/utils/path"
import SidebarNode from "./SidebarNode.vue"
import { loadChildren, resetTree, revealPath, tree } from "./tree"

const SECTION = "locations"

const { t } = useI18n()
const route = useRoute()
const root = ref<HTMLElement | null>(null)

const current = computed(() => normalizePath([route.params.pathMatch].flat().join("/")))
const collapsed = computed(() => prefs.sidebar.collapsed.includes(SECTION))
const top = computed(() => tree.get("/")?.dirs ?? [])
const atRoot = computed(() => current.value === "/")

function toggleSection() {
  const list = prefs.sidebar.collapsed
  prefs.sidebar.collapsed = collapsed.value ? list.filter((id) => id !== SECTION) : [...list, SECTION]
}

async function reveal() {
  await revealPath(current.value)
  await nextTick()
  root.value?.querySelector("[aria-current='page']")?.scrollIntoView({ block: "nearest" })
}

watch(current, reveal, { immediate: true })
watch(
  () => session.user?.username,
  () => {
    resetTree()
    void loadChildren("/").then(reveal)
  },
)
</script>

<template>
  <nav ref="root" class="nav" :aria-label="t('explorer.sidebar.label')">
    <RouterLink to="/" class="item" :class="{ 'item--active': atRoot }" :aria-current="atRoot ? 'page' : undefined">
      <FluentSvgIcon :svg="icons.home" :size="18" />
      <span>{{ t("explorer.sidebar.home") }}</span>
    </RouterLink>

    <section class="section">
      <button class="section__heading" type="button" :aria-expanded="!collapsed" @click="toggleSection">
        <FluentSvgIcon class="section__chevron" :class="{ 'section__chevron--open': !collapsed }" :svg="icons.chevronRight" :size="12" />
        {{ t("explorer.sidebar.locations") }}
      </button>
      <ul v-show="!collapsed" class="tree">
        <SidebarNode v-for="name in top" :key="name" :path="`/${name}`" :name="name" :depth="0" :current="current" />
        <li v-if="tree.get('/')?.loading" class="hint">{{ t("explorer.sidebar.loading") }}</li>
        <li v-else-if="tree.get('/')?.error" class="hint">{{ t("explorer.sidebar.loadFailed") }}</li>
        <li v-else-if="tree.get('/')?.dirs && !top.length" class="hint">{{ t("explorer.sidebar.noFolders") }}</li>
      </ul>
    </section>
  </nav>
</template>

<style scoped>
.nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding: 0 12px;
  border-radius: var(--fluent-radius);
  color: var(--fluent-text);
  text-decoration: none;
}
.item:hover {
  background: var(--fluent-control-hover);
}
.item:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.item--active {
  background: var(--fluent-selection);
}
.item--active::before {
  content: "";
  position: absolute;
  inset-inline-start: 0;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 2px;
  background: var(--fluent-accent);
}
.section {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 8px;
}
.section__heading {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 12px;
  border: 0;
  border-radius: var(--fluent-radius);
  background: none;
  color: var(--fluent-muted);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  text-align: start;
  cursor: pointer;
}
.section__heading:hover {
  background: var(--fluent-control-hover);
}
.section__heading:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.section__chevron {
  transition: transform var(--fluent-fast, 0.1s) var(--fluent-ease, ease);
}
.section__chevron--open {
  transform: rotate(90deg);
}
.tree {
  margin: 0;
  padding: 0;
}
.hint {
  list-style: none;
  padding: 4px 12px 4px 36px;
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
</style>
