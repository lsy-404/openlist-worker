<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentNotice, FluentSegmented, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminGet, adminPost, type Paged } from "@/admin/api"
import AdminRowActions from "@/admin/components/AdminRowActions.vue"
import AdminTable from "@/admin/components/AdminTable.vue"
import { notify } from "@/stores/toast"
import { formatDate, formatSize } from "@/utils/format"
import { icons } from "@/utils/icons"
import { historyIcon, stopIcon } from "./icons"
import { isoOf, type SyncItem, type SyncJob, type SyncRun } from "./types"

const props = defineProps<{ job: SyncJob; initialRun?: number | null }>()
const emit = defineEmits<{ back: [] }>()

const { t } = useI18n()

const runs = ref<SyncRun[]>([])
const runsLoading = ref(false)
const runsError = ref<string | null>(null)
const selected = ref<SyncRun | null>(null)

const items = ref<SyncItem[]>([])
const itemsTotal = ref(0)
const itemsLoading = ref(false)
const itemsError = ref<string | null>(null)
const status = ref("all")
const page = ref(1)
const PER_PAGE = 50
const pages = computed(() => Math.max(1, Math.ceil(itemsTotal.value / PER_PAGE)))

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : String(err))

async function loadRuns() {
  runsLoading.value = true
  try {
    const res = await adminGet<Paged<SyncRun>>("/sync/runs", { job_id: props.job.id, per_page: 50 })
    runs.value = res.content
    runsError.value = null
    if (selected.value) selected.value = runs.value.find((r) => r.id === selected.value!.id) ?? selected.value
  } catch (err) {
    runsError.value = errorText(err)
  } finally {
    runsLoading.value = false
  }
}

async function loadItems() {
  if (!selected.value) return
  itemsLoading.value = true
  try {
    const res = await adminGet<Paged<SyncItem>>("/sync/run/items", {
      id: selected.value.id,
      page: page.value,
      per_page: PER_PAGE,
      status: status.value === "all" ? undefined : status.value,
    })
    items.value = res.content
    itemsTotal.value = res.total
    itemsError.value = null
  } catch (err) {
    itemsError.value = errorText(err)
  } finally {
    itemsLoading.value = false
  }
}

async function openRun(id: number) {
  try {
    selected.value = await adminGet<SyncRun>("/sync/run", { id })
  } catch (err) {
    notify(errorText(err), "danger")
    return
  }
  page.value = 1
  status.value = "all"
  await loadItems()
}

async function stop(run: SyncRun) {
  try {
    await adminPost("/sync/run/stop", undefined, { id: run.id })
    notify(t("adminSync.notices.stopped"), "success")
  } catch (err) {
    notify(errorText(err), "danger")
  }
  await refresh()
}

async function refresh() {
  await loadRuns()
  if (selected.value) {
    selected.value = await adminGet<SyncRun>("/sync/run", { id: selected.value.id }).catch(() => selected.value)
    await loadItems()
  }
}

watch([status, page], () => void loadItems())

// Poll while something is still running so progress shows without manual refresh
const timer = setInterval(() => {
  if (runs.value.some((r) => r.state === "running")) void refresh()
}, 5000)
onBeforeUnmount(() => clearInterval(timer))

void loadRuns().then(() => {
  if (props.initialRun) void openRun(props.initialRun)
})

const runColumns = computed(() => [
  { key: "started", label: t("adminSync.runs.columns.started") },
  { key: "kind", label: t("adminSync.runs.columns.kind") },
  { key: "state", label: t("adminSync.runs.columns.state") },
  { key: "copied", label: t("adminSync.runs.columns.copied") },
  { key: "deleted", label: t("adminSync.runs.columns.deleted") },
  { key: "failed", label: t("adminSync.runs.columns.failed") },
  { key: "bytes", label: t("adminSync.runs.columns.bytes") },
])

const itemColumns = computed(() => [
  { key: "action", label: t("adminSync.items.columns.action") },
  { key: "rel_path", label: t("adminSync.items.columns.path") },
  { key: "target", label: t("adminSync.items.columns.target") },
  { key: "size", label: t("adminSync.items.columns.size") },
  { key: "status", label: t("adminSync.items.columns.status") },
  { key: "note", label: t("adminSync.items.columns.note") },
])

const statusOptions = computed(() => [
  { value: "all", label: t("adminSync.runs.all") },
  ...(["failed", "done", "skipped", "pending"] as const).map((value) => ({ value, label: t(`adminSync.items.statuses.${value}`) })),
])

const kindOf = (run: SyncRun) => t(run.dry_run ? "adminSync.runs.kinds.dry" : `adminSync.runs.kinds.${run.trigger}`)
const stateOf = (run: SyncRun) =>
  run.state === "running" ? `${t("adminSync.states.running")} · ${t(`adminSync.phases.${run.phase}`)}` : t(`adminSync.states.${run.state}`)
const targetOf = (item: SyncItem) => (item.target >= 0 ? (props.job.dsts[item.target] ?? `#${item.target}`) : t("adminSync.items.source"))
// The engine marks dry-run actions with this fixed reason
const noteOf = (item: SyncItem) =>
  item.error === "dry run" ? t("adminSync.items.planned") : item.error || (item.mode ? t(`adminSync.items.modes.${item.mode}`) : "")
const runActions = (run: SyncRun) => [
  { label: t("adminSync.runs.detail"), icon: historyIcon, run: () => void openRun(run.id) },
  ...(run.state === "running" ? [{ label: t("adminSync.actions.stop"), icon: stopIcon, danger: true, run: () => void stop(run) }] : []),
]
</script>

<template>
  <section class="sync-runs">
    <header class="sync-runs__head">
      <FluentButton tone="subtle" @click="emit('back')">
        <FluentSvgIcon :svg="icons.arrowLeft" :size="18" />
        {{ t("adminSync.runs.back") }}
      </FluentButton>
      <h2 class="sync-runs__title">{{ t("adminSync.runs.title", { name: job.name }) }}</h2>
      <FluentButton tone="subtle" :disabled="runsLoading" @click="refresh">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("admin.actions.refresh") }}
      </FluentButton>
    </header>

    <AdminTable
      :columns="runColumns"
      :rows="runs"
      :loading="runsLoading"
      :error="runsError"
      :empty-title="t('adminSync.runs.empty')"
      @retry="loadRuns"
    >
      <template #cell-started="{ row }">{{ formatDate(isoOf(row.started_at)) }}</template>
      <template #cell-kind="{ row }">{{ kindOf(row) }}</template>
      <template #cell-state="{ row }">
        <span :class="`sync-state sync-state--${row.state}`">{{ stateOf(row) }}</span>
      </template>
      <template #cell-copied="{ row }">{{ row.counts.copied }}</template>
      <template #cell-deleted="{ row }">{{ row.counts.deleted }}</template>
      <template #cell-failed="{ row }">{{ row.counts.failed }}</template>
      <template #cell-bytes="{ row }">{{ formatSize(row.counts.bytes) }}</template>
      <template #actions="{ row }"><AdminRowActions :items="runActions(row)" /></template>
    </AdminTable>

    <section v-if="selected" class="sync-detail">
      <h3 class="sync-runs__title">{{ t("adminSync.runs.detail") }} · {{ formatDate(isoOf(selected.started_at)) }} · {{ stateOf(selected) }}</h3>
      <p class="sync-detail__meta">
        {{ t("adminSync.runs.scanned", { dirs: selected.scanned_dirs, files: selected.scanned_files }) }}
        <template v-if="selected.counts.pending"> · {{ t("adminSync.runs.pending", { n: selected.counts.pending }) }}</template>
      </p>
      <FluentNotice v-if="selected.error" tone="danger">{{ selected.error }}</FluentNotice>
      <FluentNotice v-if="selected.delete_blocked" tone="warning">{{ t("adminSync.runs.deleteBlocked", { reason: selected.delete_blocked }) }}</FluentNotice>
      <FluentSegmented v-model="status" :options="statusOptions" :label="t('adminSync.runs.filter')" @update:model-value="page = 1" />
      <AdminTable
        :columns="itemColumns"
        :rows="items"
        :loading="itemsLoading"
        :error="itemsError"
        :empty-title="t('adminSync.runs.itemsEmpty')"
        @retry="loadItems"
      >
        <template #cell-action="{ row }">{{ t(`adminSync.items.actions.${row.action}`) }}</template>
        <template #cell-rel_path="{ row }"><span class="sync-path">{{ row.rel_path || "/" }}</span></template>
        <template #cell-target="{ row }"><span class="sync-path">{{ targetOf(row) }}</span></template>
        <template #cell-size="{ row }">{{ row.size ? formatSize(row.size) : "—" }}</template>
        <template #cell-status="{ row }">
          <span :class="`sync-state sync-state--${row.status}`">{{ t(`adminSync.items.statuses.${row.status}`) }}</span>
        </template>
        <template #cell-note="{ row }"><span class="sync-note">{{ noteOf(row) }}</span></template>
      </AdminTable>
      <nav v-if="pages > 1" class="sync-pager">
        <FluentButton :disabled="page <= 1" @click="page--">{{ t("adminSync.runs.prev") }}</FluentButton>
        <span>{{ t("adminSync.runs.page", { page, pages }) }}</span>
        <FluentButton :disabled="page >= pages" @click="page++">{{ t("adminSync.runs.next") }}</FluentButton>
      </nav>
    </section>
  </section>
</template>

<style scoped>
.sync-runs,
.sync-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sync-detail {
  margin-top: 8px;
}
.sync-runs__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.sync-runs__title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.sync-detail__meta {
  margin: 0;
  color: var(--fluent-muted);
}
.sync-path,
.sync-note {
  overflow-wrap: anywhere;
}
.sync-state--failed,
.sync-state--partial {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
.sync-state--success,
.sync-state--done {
  color: var(--fluent-success-text, var(--fluent-success));
}
.sync-state--skipped,
.sync-state--stopped,
.sync-state--pending {
  color: var(--fluent-muted);
}
.sync-pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
</style>
