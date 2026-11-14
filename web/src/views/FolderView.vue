<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useRouter } from "vue-router"
import { FluentButton, FluentCheckbox, FluentSegmented, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { createActionContext, folderEntry } from "@/actions/context"
import type { FsList } from "@/api"
import ActionBar from "@/components/ActionBar.vue"
import EntryList from "@/components/EntryList.vue"
import MarkdownView from "@/components/MarkdownView.vue"
import MenuButton from "@/components/MenuButton.vue"
import SelectionBar from "@/components/SelectionBar.vue"
import StateMessage from "@/components/StateMessage.vue"
import FolderFilter from "@/search/FolderFilter.vue"
import { useFolderFilter } from "@/search/useFolderFilter"
import { prefs, type SortKey, type ViewMode } from "@/stores/prefs"
import { clearSelection, selectAll, selection } from "@/stores/selection"
import { session } from "@/stores/session"
import { enqueueUploads, onUploadSettled } from "@/stores/uploads"
import { notify } from "@/stores/toast"
import { collectDropped, hasFiles } from "@/utils/dropped"
import { icons } from "@/utils/icons"
import { encodePath, splitPath } from "@/utils/path"

const props = defineProps<{ path: string; list: FsList; refreshing: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

const { t, locale } = useI18n()
const collator = computed(() => new Intl.Collator(locale.value, { numeric: true, sensitivity: "base" }))

const sorted = computed(() => {
  const dir = prefs.sortOrder === "asc" ? 1 : -1
  const key = prefs.sortKey
  return [...(props.list.content ?? [])].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    let diff = 0
    if (key === "name") return collator.value.compare(a.name, b.name) * dir
    if (key === "size") diff = a.size - b.size
    else diff = Date.parse(a.modified) - Date.parse(b.modified)
    return diff && !Number.isNaN(diff) ? Math.sign(diff) * dir : collator.value.compare(a.name, b.name)
  })
})

const chunk = computed(() => {
  const size = Number(session.settings?.default_page_size)
  return Number.isFinite(size) && size >= 20 ? Math.min(size, 200) : 50
})

const sortItems = computed(() => [
  { value: "name", label: t("browse.sort.name") },
  { value: "size", label: t("browse.sort.size") },
  { value: "modified", label: t("browse.sort.modified") },
])
const sortLabel = computed(() => sortItems.value.find((i) => i.value === prefs.sortKey)?.label ?? t("browse.sort.name"))

const viewOptions = computed(() => [
  { value: "list", label: t("browse.folder.viewList") },
  { value: "grid", label: t("browse.folder.viewGrid") },
])

const handlers = { refresh: () => emit("refresh"), navigate: (p: string) => router.push(encodePath(p)) }

const ctx = computed(() => {
  const name = splitPath(props.path).pop() ?? ""
  return createActionContext(
    {
      surface: "toolbar",
      kind: "folder",
      path: props.path,
      entry: folderEntry(name),
      downloadUrl: null,
      writable: props.list.write,
    },
    handlers,
  )
})

const { filtered, filtering } = useFolderFilter(() => props.path, sorted)

const picked = computed(() => sorted.value.filter((e) => selection.names.has(e.name)))
const selectionCtx = computed(() =>
  createActionContext(
    {
      surface: "selection",
      kind: "folder",
      path: props.path,
      entry: folderEntry(splitPath(props.path).pop() ?? ""),
      downloadUrl: null,
      writable: props.list.write,
      selection: picked.value,
    },
    handlers,
  ),
)
const allPicked = computed(() => sorted.value.length > 0 && picked.value.length === sorted.value.length)

watch(() => props.path, clearSelection)
onBeforeUnmount(clearSelection)
const stopUploads = onUploadSettled((dir) => {
  if (dir === props.path) emit("refresh")
})
onBeforeUnmount(stopUploads)

const dragging = ref(false)
let dragDepth = 0

function onDrag(event: DragEvent) {
  if (!hasFiles(event.dataTransfer)) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = ctx.value.caps.upload ? "copy" : "none"
  if (event.type === "dragenter") dragDepth++
  dragging.value = ctx.value.caps.upload
}

function onDragLeave(event: DragEvent) {
  if (!hasFiles(event.dataTransfer)) return
  dragDepth = Math.max(0, dragDepth - 1)
  if (!dragDepth) dragging.value = false
}

function onDrop(event: DragEvent) {
  if (!event.dataTransfer || !hasFiles(event.dataTransfer)) return
  event.preventDefault()
  dragDepth = 0
  dragging.value = false
  if (!ctx.value.caps.upload) return notify(t("browse.folder.noUploadPermission"), "danger")
  const dir = props.path
  collectDropped(event.dataTransfer).then(
    (picked) => enqueueUploads(dir, picked),
    () => notify(t("browse.folder.dropReadFailed"), "danger"),
  )
}
</script>

<template>
  <section class="folder" @dragenter="onDrag" @dragover="onDrag" @dragleave="onDragLeave" @drop="onDrop">
    <div v-if="dragging" class="dropzone" aria-hidden="true">{{ t("browse.folder.dropHint") }}</div>
    <MarkdownView v-if="list.header" :source="list.header" class="panel panel--text" />

    <div class="toolbar">
      <span class="toolbar__count">
        <FluentCheckbox
          v-if="sorted.length"
          :model-value="allPicked"
          :indeterminate="picked.length > 0 && !allPicked"
          :label="
            filtering
              ? t('browse.folder.countFiltered', { shown: filtered.length, count: sorted.length }, sorted.length)
              : t('browse.folder.count', { count: sorted.length }, sorted.length)
          "
          :aria-label="t('browse.folder.selectAll')"
          @update:model-value="(on: boolean) => (on ? selectAll(sorted.map((e) => e.name)) : clearSelection())"
        />
        <template v-else>{{ t("browse.folder.count", { count: 0 }, 0) }}</template>
      </span>
      <div class="toolbar__tools">
        <FolderFilter v-if="sorted.length" />
        <ActionBar :ctx="ctx" />
        <MenuButton
          :icon="icons.arrowSort"
          :label="t('browse.folder.sortBy')"
          :text="sortLabel"
          :items="sortItems"
          :model-value="prefs.sortKey"
          @select="(v) => (prefs.sortKey = v as SortKey)"
        />
        <FluentButton
          tone="subtle"
          icon-only
          :aria-label="prefs.sortOrder === 'asc' ? t('browse.folder.toggleToDescending') : t('browse.folder.toggleToAscending')"
          :title="prefs.sortOrder === 'asc' ? t('browse.folder.ascending') : t('browse.folder.descending')"
          @click="prefs.sortOrder = prefs.sortOrder === 'asc' ? 'desc' : 'asc'"
        >
          <FluentSvgIcon :svg="prefs.sortOrder === 'asc' ? icons.arrowUp : icons.arrowDown" :size="18" />
        </FluentButton>
        <FluentSegmented
          :label="t('browse.folder.view')"
          :model-value="prefs.view"
          :options="viewOptions"
          @update:model-value="(v: string) => (prefs.view = v as ViewMode)"
        />
        <FluentButton tone="subtle" icon-only :aria-label="t('browse.folder.refresh')" :title="t('browse.folder.refresh')" :busy="refreshing" @click="emit('refresh')">
          <FluentSvgIcon v-if="!refreshing" :svg="icons.arrowClockwise" :size="18" />
        </FluentButton>
      </div>
    </div>

    <div class="panel panel--list">
      <EntryList
        v-if="filtered.length"
        :path="path"
        :entries="filtered"
        :chunk="chunk"
        selectable
        :writable="list.write"
        @refresh="emit('refresh')"
      />
      <StateMessage v-else-if="filtering" :icon="icons.folderOpen" :title="t('browse.folder.noMatches')" :detail="t('browse.folder.noMatchesDetail')" />
      <StateMessage v-else :icon="icons.folderOpen" :title="t('browse.folder.empty')" :detail="t('browse.folder.emptyDetail')" />
    </div>

    <SelectionBar v-if="picked.length" :ctx="selectionCtx" @clear="clearSelection" />

    <MarkdownView v-if="list.readme" :source="list.readme" class="panel panel--text" />
  </section>
</template>

<style scoped>
.folder {
  position: relative;
  min-height: 50vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}
.toolbar__count {
  color: var(--fluent-muted);
}
.toolbar__tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}
.panel {
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
}
.panel--list {
  padding: 4px;
  min-height: 120px;
}
.panel--text {
  padding: 16px 20px;
}
.dropzone {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--fluent-accent-link);
  border-radius: var(--fluent-panel-radius);
  background: color-mix(in srgb, var(--fluent-surface) 85%, transparent);
  font-size: 1.1rem;
  font-weight: 600;
  pointer-events: none;
}
</style>
