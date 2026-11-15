<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink } from "vue-router"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { browseIcons, icons } from "@/utils/icons"
import { encodePath, joinPath } from "@/utils/path"
import { collapse } from "@/utils/collapse"
import { toggleNode, tree } from "./tree"

const props = defineProps<{ path: string; name: string; depth: number; current: string }>()
const { t } = useI18n()

const node = computed(() => tree.get(props.path))
const open = computed(() => !!node.value?.open)
const leaf = computed(() => node.value?.dirs?.length === 0)
const active = computed(() => props.current === props.path)
</script>

<template>
  <li class="node">
    <div class="row" :class="{ 'row--active': active }" :style="{ paddingInlineStart: `${4 + depth * 16}px` }">
      <button
        v-if="!leaf"
        class="row__toggle"
        type="button"
        :aria-label="open ? t('explorer.sidebar.collapse', { name }) : t('explorer.sidebar.expand', { name })"
        :aria-expanded="open"
        @click="toggleNode(path)"
      >
        <FluentSvgIcon class="row__chevron" :class="{ 'row__chevron--open': open }" :svg="icons.chevronRight" :size="12" />
      </button>
      <span v-else class="row__toggle" aria-hidden="true" />
      <RouterLink :to="encodePath(path)" class="row__link" :aria-current="active ? 'page' : undefined">
        <FluentSvgIcon :svg="depth === 0 ? browseIcons.hardDrive : open ? icons.folderOpen : icons.folder" :size="18" />
        <span class="row__name">{{ name }}</span>
      </RouterLink>
    </div>
    <Transition name="collapse" v-bind="collapse">
      <ul v-if="open" class="children">
        <SidebarNode
          v-for="child in node?.dirs ?? []"
          :key="child"
          :path="joinPath(path, child)"
          :name="child"
          :depth="depth + 1"
          :current="current"
        />
        <li v-if="node?.loading" class="hint" :style="{ paddingInlineStart: `${28 + (depth + 1) * 16}px` }">{{ t("explorer.sidebar.loading") }}</li>
        <li v-else-if="node?.error" class="hint" :style="{ paddingInlineStart: `${28 + (depth + 1) * 16}px` }">
          {{ node.error === "locked" ? t("explorer.sidebar.locked") : t("explorer.sidebar.loadFailed") }}
        </li>
      </ul>
    </Transition>
  </li>
</template>

<style scoped>
.node {
  list-style: none;
}
.children {
  margin: 0;
  padding: 0;
}
.row {
  position: relative;
  display: flex;
  align-items: center;
  min-height: 32px;
  padding-inline-end: 4px;
  border-radius: var(--fluent-radius);
  transition: var(--motion-fill);
}
.row:hover {
  background: var(--fluent-control-hover);
}
.row--active {
  background: var(--fluent-selection);
}
.row__toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--fluent-radius);
  background: none;
  color: var(--fluent-muted);
  cursor: pointer;
  transition: var(--motion-fill);
}
button.row__toggle:hover {
  background: var(--fluent-control-hover);
}
button.row__toggle:focus-visible,
.row__link:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.row__chevron {
  transition: transform var(--fluent-fast) var(--fluent-ease);
}
.row__chevron--open {
  transform: rotate(90deg);
}
.row__link {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  min-height: 32px;
  border-radius: var(--fluent-radius);
  color: var(--fluent-text);
  text-decoration: none;
}
.row__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hint {
  list-style: none;
  min-height: 28px;
  line-height: 28px;
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
</style>
