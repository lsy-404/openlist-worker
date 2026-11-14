<script setup lang="ts">
import { computed } from "vue"
import { useRouter } from "vue-router"
import { FluentButton, FluentSegmented, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { createActionContext, folderEntry } from "@/actions/context"
import type { FsList } from "@/api"
import ActionBar from "@/components/ActionBar.vue"
import EntryList from "@/components/EntryList.vue"
import MarkdownView from "@/components/MarkdownView.vue"
import MenuButton from "@/components/MenuButton.vue"
import StateMessage from "@/components/StateMessage.vue"
import { prefs, type SortKey, type ViewMode } from "@/stores/prefs"
import { session } from "@/stores/session"
import { icons } from "@/utils/icons"
import { encodePath, splitPath } from "@/utils/path"

const props = defineProps<{ path: string; list: FsList; refreshing: boolean }>()
const emit = defineEmits<{ refresh: [] }>()
const router = useRouter()

const collator = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" })

const sorted = computed(() => {
  const dir = prefs.sortOrder === "asc" ? 1 : -1
  const key = prefs.sortKey
  return [...(props.list.content ?? [])].sort((a, b) => {
    if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1
    let diff = 0
    if (key === "name") return collator.compare(a.name, b.name) * dir
    if (key === "size") diff = a.size - b.size
    else diff = Date.parse(a.modified) - Date.parse(b.modified)
    return diff && !Number.isNaN(diff) ? Math.sign(diff) * dir : collator.compare(a.name, b.name)
  })
})

const chunk = computed(() => {
  const size = Number(session.settings?.default_page_size)
  return Number.isFinite(size) && size >= 20 ? Math.min(size, 200) : 50
})

const sortItems = [
  { value: "name", label: "名称" },
  { value: "size", label: "大小" },
  { value: "modified", label: "修改时间" },
]
const sortLabel = computed(() => sortItems.find((i) => i.value === prefs.sortKey)?.label ?? "名称")

const viewOptions = [
  { value: "list", label: "列表" },
  { value: "grid", label: "网格" },
]

const ctx = computed(() => {
  const name = splitPath(props.path).pop() ?? ""
  return createActionContext(
    { surface: "toolbar", kind: "folder", path: props.path, entry: folderEntry(name), downloadUrl: null },
    { refresh: () => emit("refresh"), navigate: (p) => router.push(encodePath(p)) },
  )
})
</script>

<template>
  <section class="folder">
    <MarkdownView v-if="list.header" :source="list.header" class="panel panel--text" />

    <div class="toolbar">
      <span class="toolbar__count">{{ sorted.length }} 项</span>
      <div class="toolbar__tools">
        <ActionBar :ctx="ctx" />
        <MenuButton
          :icon="icons.arrowSort"
          label="排序方式"
          :text="sortLabel"
          :items="sortItems"
          :model-value="prefs.sortKey"
          @select="(v) => (prefs.sortKey = v as SortKey)"
        />
        <FluentButton
          tone="subtle"
          icon-only
          :aria-label="prefs.sortOrder === 'asc' ? '升序，点击切换为降序' : '降序，点击切换为升序'"
          :title="prefs.sortOrder === 'asc' ? '升序' : '降序'"
          @click="prefs.sortOrder = prefs.sortOrder === 'asc' ? 'desc' : 'asc'"
        >
          <FluentSvgIcon :svg="prefs.sortOrder === 'asc' ? icons.arrowUp : icons.arrowDown" :size="18" />
        </FluentButton>
        <FluentSegmented
          label="视图"
          :model-value="prefs.view"
          :options="viewOptions"
          @update:model-value="(v: string) => (prefs.view = v as ViewMode)"
        />
        <FluentButton tone="subtle" icon-only aria-label="刷新" title="刷新" :busy="refreshing" @click="emit('refresh')">
          <FluentSvgIcon v-if="!refreshing" :svg="icons.arrowClockwise" :size="18" />
        </FluentButton>
      </div>
    </div>

    <div class="panel panel--list">
      <EntryList v-if="sorted.length" :path="path" :entries="sorted" :chunk="chunk" @refresh="emit('refresh')" />
      <StateMessage v-else :icon="icons.folderOpen" title="这个文件夹是空的" detail="这里还没有任何文件。" />
    </div>

    <MarkdownView v-if="list.readme" :source="list.readme" class="panel panel--text" />
  </section>
</template>

<style scoped>
.folder {
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
</style>
