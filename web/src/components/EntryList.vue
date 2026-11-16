<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { RouterLink, useRouter } from "vue-router"
import { FluentButton, FluentCheckbox, FluentMenu, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { actionLabel, actionsFor, type ActionContext } from "@/actions"
import { createActionContext } from "@/actions/context"
import type { FsEntry } from "@/api"
import type { Group } from "@/browse/arrange"
import { isCut } from "@/browse/clipboard"
import { entryTypeLabel } from "@/browse/entryType"
import { prefs, toggleSort, type SortKey } from "@/stores/prefs"
import { clearSelection, selectAll, selection, toggleSelection } from "@/stores/selection"
import { formatDate, formatSize } from "@/utils/format"
import { browseIcons, iconForEntry, icons } from "@/utils/icons"
import { entryDownloadUrl } from "@/utils/links"
import { encodePath, joinPath } from "@/utils/path"

const props = defineProps<{ path: string; groups: Group[]; chunk: number; selectable?: boolean; writable?: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

const grouped = computed(() => prefs.arrange.groupKey !== "none")
const collapsed = ref(new Set<string>())
watch(() => [props.path, prefs.arrange.groupKey], () => (collapsed.value = new Set()))

function toggleGroup(id: string) {
  const next = new Set(collapsed.value)
  if (!next.delete(id)) next.add(id)
  collapsed.value = next
}

const open = computed(() => props.groups.filter((g) => !collapsed.value.has(g.id)))
const names = computed(() => open.value.flatMap((g) => g.entries.map((e) => e.name)))

const visible = ref(props.chunk)
watch(
  () => [props.groups, props.chunk],
  () => (visible.value = props.chunk),
)
// Chunking counts only entries that are on screen, so collapsed groups keep their header and cost nothing
const shown = computed(() => {
  let left = visible.value
  return props.groups.map((group) => {
    const entries = collapsed.value.has(group.id) ? [] : group.entries.slice(0, Math.max(left, 0))
    left -= entries.length
    return { ...group, shown: entries }
  })
})
const remaining = computed(() => names.value.length - shown.value.reduce((n, g) => n + g.shown.length, 0))

function showMore() {
  visible.value += props.chunk
}

// Load the next chunk automatically when the sentinel scrolls into view
const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null
onMounted(() => {
  if (typeof IntersectionObserver === "undefined") return
  observer = new IntersectionObserver((hits) => {
    if (hits.some((h) => h.isIntersecting) && remaining.value > 0) showMore()
  }, { rootMargin: "400px" })
  watch(sentinel, (el, old) => {
    if (old) observer?.unobserve(old)
    if (el) observer?.observe(el)
  }, { immediate: true })
})
onBeforeUnmount(() => observer?.disconnect())

const selecting = computed(() => selection.names.size > 0)
let shift = false as boolean

// Label clicks reach the input as synthetic clicks without modifiers, so shift is read from the real pointer or key event
function pick(name: string) {
  toggleSelection(name, names.value, shift)
  shift = false
}

function href(entry: FsEntry) {
  return encodePath(joinPath(props.path, entry.name))
}

function contextFor(entry: FsEntry): ActionContext {
  const path = joinPath(props.path, entry.name)
  return createActionContext(
    {
      surface: "context",
      kind: entry.is_dir ? "folder" : "file",
      path,
      entry,
      downloadUrl: entry.is_dir ? null : entryDownloadUrl(path, entry.sign),
      writable: props.writable,
    },
    { refresh: () => emit("refresh"), navigate: (p) => router.push(encodePath(p)) },
  )
}

const menu = ref<{ open: boolean; anchor: HTMLElement | null; ctx: ActionContext | null }>({
  open: false,
  anchor: null,
  ctx: null,
})
const menuItems = computed(() =>
  menu.value.ctx ? actionsFor(menu.value.ctx).map((a) => ({ value: a.id, label: actionLabel(a, menu.value.ctx!) })) : [],
)

async function openMenu(entry: FsEntry, anchor: HTMLElement | null) {
  menu.value = { open: false, anchor, ctx: contextFor(entry) }
  await nextTick()
  menu.value.open = true
}

function onMenuSelect(id: string) {
  const ctx = menu.value.ctx
  const action = ctx && actionsFor(ctx).find((a) => a.id === id)
  if (ctx && action) void action.run(ctx)
}

function onContextMenu(event: MouseEvent, entry: FsEntry) {
  const row = (event.currentTarget as HTMLElement).closest<HTMLElement>(".entry")
  event.preventDefault()
  void openMenu(entry, row)
}

const { t } = useI18n()
const columns: SortKey[] = ["name", "modified", "type", "size"]
const allPicked = computed(() => names.value.length > 0 && names.value.every((n) => selection.names.has(n)))
const somePicked = computed(() => !allPicked.value && names.value.some((n) => selection.names.has(n)))
function ariaSort(key: SortKey) {
  return prefs.arrange.sortKey === key ? (prefs.arrange.sortOrder === "asc" ? "ascending" : "descending") : "none"
}
</script>

<template>
  <div class="entries" :data-view="prefs.view" :class="{ 'entries--selectable': selectable, 'entries--selecting': selecting }">
    <div v-if="prefs.view === 'list'" class="head" role="row">
      <span v-if="selectable" class="head__check">
        <FluentCheckbox
          :model-value="allPicked"
          :indeterminate="somePicked"
          :aria-label="t('explorer.command.selectAll')"
          @update:model-value="(on: boolean) => (on ? selectAll(names) : clearSelection())"
        />
      </span>
      <button
        v-for="key in columns"
        :key="key"
        class="head__cell"
        :class="`head__cell--${key}`"
        :aria-sort="ariaSort(key)"
        @click="toggleSort(key)"
      >
        {{ t(`explorer.columns.${key}`) }}
        <FluentSvgIcon
          v-if="prefs.arrange.sortKey === key"
          :svg="prefs.arrange.sortOrder === 'asc' ? icons.arrowUp : icons.arrowDown"
          :size="12"
        />
      </button>
      <span class="head__cell head__cell--more" />
    </div>

    <section v-for="group in shown" :key="group.id" class="group">
      <h3 v-if="grouped" class="group__head">
        <button
          class="group__toggle"
          :aria-expanded="!collapsed.has(group.id)"
          :aria-label="t(collapsed.has(group.id) ? 'explorer.group.expand' : 'explorer.group.collapse', { name: group.label })"
          @click="toggleGroup(group.id)"
        >
          <FluentSvgIcon class="group__chevron" :svg="browseIcons.chevronDown" :size="12" />
          <span class="group__label">{{ group.label }}</span>
          <span class="group__count">{{ group.entries.length }}</span>
        </button>
        <span class="group__line" aria-hidden="true" />
      </h3>
      <ul v-if="!collapsed.has(group.id)" class="items">
      <li
        v-for="entry in group.shown"
        :key="entry.name"
        class="entry"
        :class="{ 'entry--selected': selection.names.has(entry.name), 'entry--cut': isCut(path, entry.name) }"
        @contextmenu="onContextMenu($event, entry)"
      >
        <span
          v-if="selectable"
          class="entry__check"
          @mousedown.capture="(e: MouseEvent) => { shift = e.shiftKey; if (shift) e.preventDefault() }"
          @keydown.capture="(e: KeyboardEvent) => { shift = e.shiftKey }"
        >
          <FluentCheckbox
            :model-value="selection.names.has(entry.name)"
            :aria-label="t('browse.entryList.select', { name: entry.name })"
            @update:model-value="pick(entry.name)"
          />
        </span>
        <RouterLink :to="href(entry)" class="entry__link">
          <span class="entry__icon">
            <img v-if="prefs.view === 'grid' && entry.thumb" :src="entry.thumb" alt="" loading="lazy" />
            <FluentSvgIcon v-else :svg="iconForEntry(entry)" :size="prefs.view === 'grid' ? 40 : 22" />
          </span>
          <span class="entry__name">{{ entry.name }}</span>
          <span class="entry__time">{{ formatDate(entry.modified) }}</span>
          <span class="entry__type">{{ entryTypeLabel(entry) }}</span>
          <span class="entry__size">{{ entry.is_dir && !entry.size ? "" : formatSize(entry.size) }}</span>
          <span class="entry__meta">{{ entry.is_dir && !entry.size ? "" : formatSize(entry.size) + " · " }}{{ formatDate(entry.modified) }}</span>
        </RouterLink>
        <FluentButton
          class="entry__more"
          tone="subtle"
          icon-only
          :aria-label="t('browse.entryList.moreFor', { name: entry.name })"
          aria-haspopup="menu"
          @click="(e: MouseEvent) => openMenu(entry, (e.currentTarget as HTMLElement))"
        >
          <FluentSvgIcon :svg="icons.moreHorizontal" :size="18" />
        </FluentButton>
      </li>
      </ul>
    </section>

    <div v-if="remaining > 0" ref="sentinel" class="more">
      <FluentButton @click="showMore">{{ t("browse.entryList.showMore", { count: remaining }) }}</FluentButton>
    </div>

    <FluentMenu
      v-model:open="menu.open"
      :label="t('browse.entryList.moreActions')"
      :anchor="menu.anchor"
      :items="menuItems"
      @select="onMenuSelect"
    />
  </div>
</template>

<style scoped>
.entries {
  --cols: minmax(0, 1fr) 150px 130px 84px 40px;
}
.head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--fluent-surface);
  display: grid;
  grid-template-columns: var(--cols);
  align-items: center;
  padding: 0 4px 0 12px;
  border-bottom: 1px solid var(--fluent-border);
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.head__cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  border-radius: var(--fluent-radius);
  transition: var(--motion-fill);
}
.head__cell:hover {
  background: var(--fluent-control-hover);
}
.head__cell:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.head__cell--more {
  cursor: default;
  pointer-events: none;
}
.group__head {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0 4px;
  font-size: inherit;
}
[data-view="list"] .group__head {
  padding-inline-start: 12px;
  background: var(--fluent-surface);
  position: sticky;
  top: 37px;
  z-index: 1;
}
.group__toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--fluent-radius);
  background: none;
  color: var(--fluent-muted);
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition: var(--motion-fill);
}
.group__toggle:hover {
  background: var(--fluent-control-hover);
}
.group__toggle:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.group__label {
  font-weight: 600;
}
.group__count {
  opacity: 0.75;
}
.group__chevron {
  transition: transform var(--fluent-fast) var(--fluent-ease);
}
.group__toggle[aria-expanded="false"] .group__chevron {
  transform: rotate(-90deg);
}
.group__line {
  flex: 1;
  height: 1px;
  background: var(--fluent-border);
}
[data-view="list"].entries--selectable .group__head {
  padding-inline-start: 44px;
}
.items {
  list-style: none;
  margin: 0;
  padding: 0;
}
.entry {
  position: relative;
  display: grid;
  grid-template-columns: var(--cols);
  align-items: center;
  padding: 0 4px 0 12px;
  border-radius: var(--fluent-radius);
  transition: var(--motion-fill);
}
.entry:hover {
  background: var(--fluent-control-hover);
}
.entry__link {
  display: contents;
  color: inherit;
  text-decoration: none;
}
.entry__link:focus-visible {
  outline: none;
}
.entry:has(.entry__link:focus-visible) {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.entry__name {
  grid-column: 1;
  grid-row: 1;
  display: block;
  min-height: 44px;
  padding-inline-start: 38px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 44px;
}
.entry__icon {
  display: inline-flex;
  position: absolute;
  inset-inline-start: 20px;
  top: 0;
  height: 44px;
  align-items: center;
  pointer-events: none;
}
.entry__size,
.entry__time,
.entry__type {
  color: var(--fluent-muted);
  font-size: 0.9rem;
  padding: 0 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.entry__size {
  text-align: end;
}
.head__cell--size {
  justify-content: flex-end;
}
.head__check {
  position: absolute;
  inset-inline-start: 12px;
  display: flex;
  align-items: center;
  height: 36px;
}
.entry--cut .entry__link {
  opacity: 0.5;
}
.entry__meta {
  display: none;
}
.entry__more {
  justify-self: center;
}

.entries--selectable .head,
.entries--selectable .entry {
  padding-inline-start: 44px;
}
.entries--selectable .entry__icon {
  inset-inline-start: 52px;
}
.entry__check {
  position: absolute;
  inset-inline-start: 12px;
  top: 0;
  bottom: 0;
  z-index: 1;
  display: flex;
  align-items: center;
}
.entry--selected {
  background: var(--fluent-control-hover);
}

.more {
  display: flex;
  justify-content: center;
  padding: 16px;
}

/* Grid view */
[data-view="grid"] .items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(136px, 1fr));
  gap: 8px;
}
[data-view="grid"] .entry {
  display: block;
  padding: 0;
  border: 1px solid transparent;
  transition:
    var(--motion-fill),
    border-color var(--fluent-faster) var(--fluent-ease);
}
[data-view="grid"] .entry:hover {
  border-color: var(--fluent-border);
}
[data-view="grid"] .entry__link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 16px 8px 12px;
  text-align: center;
}
[data-view="grid"] .entry__icon {
  position: static;
  height: 64px;
  width: 100%;
  justify-content: center;
}
[data-view="grid"] .entry__icon img {
  max-width: 100%;
  max-height: 64px;
  border-radius: var(--fluent-radius);
  object-fit: cover;
}
[data-view="grid"] .entry__name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  white-space: normal;
  overflow-wrap: anywhere;
  min-height: 0;
  padding: 0;
  line-height: 1.35;
  font-size: 0.9rem;
  width: 100%;
}
[data-view="grid"] .entry__size {
  padding: 0;
  font-size: 0.8rem;
  text-align: center;
}
[data-view="grid"] .entry__time,
[data-view="grid"] .entry__type {
  display: none;
}
[data-view="grid"] .entry__more {
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
  opacity: 0;
  transition:
    opacity var(--fluent-faster) var(--fluent-ease),
    background var(--fluent-fast) var(--fluent-ease),
    border-color var(--fluent-fast) var(--fluent-ease);
}
[data-view="grid"] .entry:hover .entry__more,
[data-view="grid"] .entry__more:focus-visible {
  opacity: 1;
}
@media (hover: none) {
  [data-view="grid"] .entry__more {
    opacity: 1;
  }
}

[data-view="grid"].entries--selectable .entry {
  padding: 0;
}
[data-view="grid"] .entry__check {
  inset-inline-start: 6px;
  top: 6px;
  bottom: auto;
  opacity: 0;
  transition: opacity var(--fluent-faster) var(--fluent-ease);
}
[data-view="grid"] .entry:hover .entry__check,
[data-view="grid"] .entry__check:focus-within,
[data-view="grid"].entries--selecting .entry__check {
  opacity: 1;
}
@media (hover: none) {
  [data-view="grid"] .entry__check {
    opacity: 1;
  }
}
[data-view="grid"].entries--selectable .entry__icon {
  inset-inline-start: auto;
}

/* Phones: size and time collapse into one line under the name */
@media (max-width: 640px) {
  .entries {
    --cols: minmax(0, 1fr) 40px;
  }
  .head__cell--size,
  .head__cell--modified,
  .head__cell--type {
    display: none;
  }
  [data-view="list"] .entry__size,
  [data-view="list"] .entry__time,
  [data-view="list"] .entry__type {
    display: none;
  }
  [data-view="list"] .entry {
    min-height: 56px;
  }
  [data-view="list"] .entry__name {
    line-height: 1.3;
    padding-top: 9px;
    min-height: 0;
    align-self: end;
  }
  [data-view="list"] .entry__icon {
    height: 56px;
  }
  [data-view="list"] .entry__meta {
    display: block;
    grid-column: 1;
    grid-row: 2;
    padding-inline-start: 38px;
    padding-bottom: 9px;
    color: var(--fluent-muted);
    font-size: 0.8rem;
  }
  [data-view="list"] .entry__more {
    grid-column: 2;
    grid-row: 1 / span 2;
  }
  [data-view="grid"] .items {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
}
</style>
