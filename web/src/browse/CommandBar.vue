<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon, type FluentMenuItem } from "@platform-kit/fluent/vue"
import MenuButton from "@/components/MenuButton.vue"
import { prefs, type SortKey, type SortOrder, type ViewMode } from "@/stores/prefs"
import { browseIcons, icons } from "@/utils/icons"
import type { Command, Commands } from "./commands"
import { useWidth } from "./useWidth"

const props = defineProps<{ commands: Commands }>()
const { t } = useI18n()

const bar = ref<HTMLElement | null>(null)
const width = useWidth(bar)
// Labels give way to icons first, then everything but New collapses into the More menu
const mode = computed<"full" | "icons" | "compact">(() => (width.value >= 780 ? "full" : width.value >= 500 ? "icons" : "compact"))

const groups = computed(() => {
  const c = props.commands
  return [[c.cut, c.copy, c.paste], [c.rename, c.remove], [c.download]]
    .map((group) => group.filter((cmd): cmd is Command => !!cmd))
    .filter((group) => group.length)
})

const overflow = computed<Command[][]>(() => {
  const c = props.commands
  const extra = [c.moveTo, c.copyTo, c.copyLink].filter((cmd): cmd is Command => !!cmd)
  return [...(mode.value === "compact" ? groups.value : []), extra, [c.selectAll, c.selectNone]].filter((group) => group.length)
})

const overflowItems = computed<FluentMenuItem[]>(() =>
  overflow.value.flatMap((group, i) => [
    ...(i ? [{ separator: true } as FluentMenuItem] : []),
    ...group.map((cmd) => ({ value: cmd.id, label: cmd.label, disabled: cmd.disabled })),
  ]),
)

function runOverflow(id: string) {
  overflow.value.flat().find((cmd) => cmd.id === id)?.run()
}

const newItems = computed(() => props.commands.newItems.map((cmd) => ({ value: cmd.id, label: cmd.label })))
function runNew(id: string) {
  props.commands.newItems.find((cmd) => cmd.id === id)?.run()
}

const sortKeys: SortKey[] = ["name", "modified", "type", "size"]
const sortItems = computed<FluentMenuItem[]>(() => [
  ...sortKeys.map((key) => ({ value: key, label: t(`explorer.columns.${key}`) })),
  { separator: true },
  { value: "asc", label: t("explorer.command.ascending") },
  { value: "desc", label: t("explorer.command.descending") },
])
function selectSort(value: string) {
  if (sortKeys.includes(value as SortKey)) prefs.sortKey = value as SortKey
  else prefs.sortOrder = value as SortOrder
}

const layoutItems = computed(() => [
  { value: "list", label: t("explorer.layout.details") },
  { value: "grid", label: t("explorer.layout.grid") },
])
const layoutIcon = computed(() => (prefs.view === "grid" ? icons.gridView : browseIcons.appsListDetail))
</script>

<template>
  <div ref="bar" class="bar" role="toolbar" :aria-label="t('explorer.command.label')">
    <div class="bar__group">
      <MenuButton
        v-if="newItems.length"
        :icon="icons.add"
        :label="t('explorer.command.new')"
        :text="t('explorer.command.new')"
        chevron
        :items="newItems"
        @select="runNew"
      />
      <template v-if="mode !== 'compact'">
        <template v-for="(group, i) in groups" :key="i">
          <span v-if="i || newItems.length" class="bar__divider" aria-hidden="true" />
          <FluentButton
            v-for="cmd in group"
            :key="cmd.id"
            tone="subtle"
            :icon-only="mode === 'icons'"
            :disabled="cmd.disabled"
            :aria-label="cmd.label"
            :title="cmd.label"
            @click="cmd.run()"
          >
            <FluentSvgIcon :svg="cmd.icon" :size="20" />
            <template v-if="mode === 'full'">{{ cmd.label }}</template>
          </FluentButton>
        </template>
      </template>
    </div>

    <div class="bar__group bar__group--end">
      <MenuButton
        :icon="icons.arrowSort"
        :label="t('explorer.command.sort')"
        :text="mode === 'full' ? t('explorer.command.sort') : undefined"
        :items="sortItems"
        :model-value="[prefs.sortKey, prefs.sortOrder]"
        @select="selectSort"
      />
      <MenuButton
        :icon="layoutIcon"
        :label="t('explorer.command.layout')"
        :text="mode === 'full' ? t('explorer.command.layout') : undefined"
        :items="layoutItems"
        :model-value="prefs.view"
        @select="(v) => (prefs.view = v as ViewMode)"
      />
      <MenuButton :icon="icons.moreHorizontal" :label="t('explorer.command.more')" :items="overflowItems" @select="runOverflow" />
    </div>
  </div>
</template>

<style scoped>
.bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 44px;
  padding: 0 8px;
}
.bar__group {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.bar__divider {
  align-self: center;
  width: 1px;
  height: 20px;
  margin: 0 4px;
  background: var(--fluent-border);
}
</style>
