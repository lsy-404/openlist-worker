<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { capsFor } from "@/actions"
import type { FsList } from "@/api"
import EntryList from "@/components/EntryList.vue"
import MarkdownView from "@/components/MarkdownView.vue"
import StateMessage from "@/components/StateMessage.vue"
import { useFolderFilter } from "@/search/useFolderFilter"
import { groupEntries, sortEntries } from "@/browse/arrange"
import { prefs } from "@/stores/prefs"
import { clearSelection } from "@/stores/selection"
import { session } from "@/stores/session"
import { enqueueUploads, onUploadSettled } from "@/stores/uploads"
import { notify } from "@/stores/toast"
import { collectDropped, hasFiles } from "@/utils/dropped"
import { icons } from "@/utils/icons"

const props = defineProps<{ path: string; list: FsList }>()
const emit = defineEmits<{ refresh: [] }>()

const { t } = useI18n()

const sorted = computed(() => sortEntries(props.list.content ?? [], prefs.arrange))

const chunk = computed(() => {
  const size = Number(session.settings?.default_page_size)
  return Number.isFinite(size) && size >= 20 ? Math.min(size, 200) : 50
})

const canUpload = computed(() => capsFor(props.list.write).upload)

const { filtered, filtering } = useFolderFilter(() => props.path, sorted)
const groups = computed(() => groupEntries(filtered.value, prefs.arrange))

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
  if (event.dataTransfer) event.dataTransfer.dropEffect = canUpload.value ? "copy" : "none"
  if (event.type === "dragenter") dragDepth++
  dragging.value = canUpload.value
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
  if (!canUpload.value) return notify(t("browse.folder.noUploadPermission"), "danger")
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

    <div class="panel panel--list">
      <EntryList
        v-if="filtered.length"
        :path="path"
        :groups="groups"
        :chunk="chunk"
        selectable
        :writable="list.write"
        @refresh="emit('refresh')"
      />
      <StateMessage v-else-if="filtering" :icon="icons.folderOpen" :title="t('browse.folder.noMatches')" :detail="t('browse.folder.noMatchesDetail')" />
      <StateMessage v-else :icon="icons.folderOpen" :title="t('browse.folder.empty')" :detail="t('browse.folder.emptyDetail')" />
    </div>

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
.panel {
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
}
.panel--list {
  min-height: 120px;
  background: none;
  border: 0;
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
