<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { RouterLink, useRoute } from "vue-router"
import search from "@fluentui/svg-icons/icons/search_24_regular.svg?raw"
import { FluentButton, FluentDialog, FluentProgressRing, FluentSegmented, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import StateMessage from "@/components/StateMessage.vue"
import { passwordFor } from "@/stores/passwords"
import { basePath } from "@/stores/session"
import { extension, formatSize } from "@/utils/format"
import { iconForEntry, icons } from "@/utils/icons"
import { encodePath, joinPath, normalizePath, parentPath } from "@/utils/path"
import { searchFiles, type SearchHit } from "./api"
import { searchUi, type SearchScope } from "./state"

const route = useRoute()

const scopeOptions = [
  { value: "folder", label: "当前文件夹" },
  { value: "site", label: "全站" },
]

const folder = computed(() => {
  if (searchUi.folder) return searchUi.folder
  // No folder view is mounted (file page, or still loading): a dotted last segment is taken as a file
  const path = normalizePath([route.params.pathMatch ?? ""].flat().join("/"))
  return extension(path) ? parentPath(path) : path
})
const parent = computed(() => (searchUi.scope === "site" ? "/" : folder.value))

const hits = ref<SearchHit[]>([])
const total = ref(0)
const page = ref(0)
const loading = ref(false)
const error = ref<ApiError | null>(null)
const done = ref(false)
let controller: AbortController | null = null

const hasMore = computed(() => hits.value.length < total.value)
const totalText = computed(() => (total.value >= 500 ? "500+" : String(total.value)))
const unavailable = computed(
  () => !!error.value && (error.value.code === 501 || /unavailable|not (enabled|available|configured)|index/i.test(error.value.message)),
)

async function load(next: number) {
  controller?.abort()
  const current = (controller = new AbortController())
  loading.value = true
  error.value = null
  try {
    const result = await searchFiles(
      { parent: parent.value, keywords: searchUi.query, page: next, password: passwordFor(parent.value) },
      current.signal,
    )
    if (current.signal.aborted) return
    hits.value = next === 1 ? (result.content ?? []) : [...hits.value, ...(result.content ?? [])]
    total.value = result.total
    page.value = next
    done.value = true
  } catch (err) {
    if (current.signal.aborted) return
    error.value = err instanceof ApiError ? err : new ApiError("server", String(err), 0)
  } finally {
    if (controller === current) loading.value = false
  }
}

function start() {
  hits.value = []
  total.value = 0
  page.value = 0
  done.value = false
  void load(1)
}

watch(
  () => [searchUi.open, searchUi.query, searchUi.scope, parent.value],
  () => {
    if (searchUi.open) start()
    else controller?.abort()
  },
)
onBeforeUnmount(() => controller?.abort())

// Hits carry the full backend path; the UI works in paths relative to the user's base path
function relative(dir: string): string {
  const base = basePath.value === "/" ? "" : normalizePath(basePath.value)
  if (base && (dir === base || dir.startsWith(base + "/"))) return dir.slice(base.length) || "/"
  return dir
}

function target(hit: SearchHit): string {
  return encodePath(joinPath(relative(hit.parent), hit.name))
}

const body = ref<HTMLElement | null>(null)
function onKeydown(event: KeyboardEvent) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) || !body.value) return
  const links = [...body.value.querySelectorAll<HTMLElement>("a.hit")]
  if (!links.length) return
  const index = links.indexOf(document.activeElement as HTMLElement)
  let next: number
  if (event.key === "ArrowDown") next = index < 0 ? 0 : Math.min(index + 1, links.length - 1)
  else if (event.key === "ArrowUp") next = index <= 0 ? 0 : index - 1
  else next = event.key === "Home" ? 0 : links.length - 1
  event.preventDefault()
  links[next].focus()
}

function close() {
  searchUi.open = false
}
</script>

<template>
  <FluentDialog :open="searchUi.open" label="搜索" close-on-outside @close="close">
    <template #title>
      <h2 class="title">搜索“{{ searchUi.query }}”</h2>
    </template>

    <div ref="body" class="body" @keydown="onKeydown">
      <div class="bar">
        <FluentSegmented
          label="搜索范围"
          :model-value="searchUi.scope"
          :options="scopeOptions"
          @update:model-value="(v: string) => (searchUi.scope = v as SearchScope)"
        />
        <span class="where" :title="parent">{{ parent }}</span>
      </div>

      <div class="results" aria-live="polite">
        <div v-if="loading && !hits.length" class="busy">
          <FluentProgressRing :size="28" indeterminate label="正在搜索" />
          <p>正在搜索，目录较多时可能需要一些时间</p>
        </div>

        <StateMessage
          v-else-if="error && !hits.length"
          :icon="icons.warning"
          :title="unavailable ? '搜索暂不可用' : error.kind === 'network' ? '无法连接到服务器' : '搜索失败'"
          :detail="error.message"
        >
          <FluentButton v-if="!unavailable" tone="primary" @click="start">重试</FluentButton>
        </StateMessage>

        <StateMessage
          v-else-if="done && !hits.length"
          :icon="search"
          title="没有找到匹配项"
          :detail="searchUi.scope === 'folder' ? '当前文件夹及其子文件夹中没有匹配的名称。' : '全站没有匹配的名称。'"
        >
          <FluentButton v-if="searchUi.scope === 'folder' && parent !== '/'" @click="searchUi.scope = 'site'">在全站搜索</FluentButton>
        </StateMessage>

        <template v-else-if="hits.length">
          <p class="count">共 {{ totalText }} 项</p>
          <ul class="list">
            <li v-for="(hit, i) in hits" :key="`${hit.parent}/${hit.name}/${i}`">
              <RouterLink class="hit" :to="target(hit)" @click="close">
                <FluentSvgIcon :svg="iconForEntry(hit)" :size="22" />
                <span class="hit__text">
                  <span class="hit__name">{{ hit.name }}</span>
                  <span class="hit__path">{{ relative(hit.parent) }}</span>
                </span>
                <span class="hit__size">{{ hit.is_dir ? "文件夹" : formatSize(hit.size) }}</span>
              </RouterLink>
            </li>
          </ul>
          <p v-if="error" class="inline-error" role="alert">{{ error.message }}</p>
          <div v-if="hasMore || error" class="more">
            <FluentButton :busy="loading" @click="load(page + 1)">
              {{ error ? "重试" : `加载更多（还有 ${total - hits.length} 项）` }}
            </FluentButton>
          </div>
        </template>
      </div>
    </div>

    <template #footer>
      <FluentButton @click="close">关闭</FluentButton>
    </template>
  </FluentDialog>
</template>

<style scoped>
.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: min(504px, 68vw);
}
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.where {
  min-width: 0;
  color: var(--fluent-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.results {
  max-height: min(60vh, 520px);
  overflow-x: hidden;
  overflow-y: auto;
}
.busy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 0;
  color: var(--fluent-muted);
}
.busy p,
.count,
.inline-error {
  margin: 0;
}
.count {
  padding: 0 4px 6px;
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.inline-error {
  padding: 8px 4px;
  color: var(--fluent-danger, var(--fluent-text));
}
.list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.hit {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px;
  border-radius: var(--fluent-radius);
  color: var(--fluent-text);
  text-decoration: none;
}
.hit:hover {
  background: var(--fluent-control-hover);
}
.hit:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
  background: var(--fluent-control-hover);
}
.hit__text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.hit__name,
.hit__path {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hit__path,
.hit__size {
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.hit__size {
  flex: none;
}
.more {
  display: flex;
  justify-content: center;
  padding: 12px 0 4px;
}
</style>
