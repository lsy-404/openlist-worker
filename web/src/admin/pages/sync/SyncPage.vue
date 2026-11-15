<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminList, adminPost } from "@/admin/api"
import { confirmDelete } from "@/admin/confirm"
import AdminPage from "@/admin/components/AdminPage.vue"
import AdminRowActions from "@/admin/components/AdminRowActions.vue"
import AdminTable from "@/admin/components/AdminTable.vue"
import { useAdminList } from "@/admin/useAdminList"
import { notify } from "@/stores/toast"
import { formatDate } from "@/utils/format"
import { icons } from "@/utils/icons"
import { dryRunIcon, historyIcon, pauseIcon, playIcon, stopIcon, syncIcon } from "./icons"
import SyncJobPanel from "./SyncJobPanel.vue"
import SyncRuns from "./SyncRuns.vue"
import { isoOf, type SyncJob, type SyncRun } from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList((signal) => adminList<SyncJob>("/sync/jobs", undefined, signal))

const columns = computed(() => [
  { key: "name", label: t("adminSync.columns.name") },
  { key: "route", label: t("adminSync.columns.route") },
  { key: "method", label: t("adminSync.columns.method") },
  { key: "schedule", label: t("adminSync.columns.schedule") },
  { key: "lastRun", label: t("adminSync.columns.lastRun") },
  { key: "nextRun", label: t("adminSync.columns.nextRun") },
])

const panelOpen = ref(false)
const editing = ref<SyncJob | null>(null)
const history = ref<{ job: SyncJob; run: number | null } | null>(null)

function openCreate() {
  editing.value = null
  panelOpen.value = true
}

function openEdit(row: SyncJob) {
  editing.value = row
  panelOpen.value = true
}

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : String(err))

async function act(fn: () => Promise<unknown>, success: string) {
  try {
    await fn()
    notify(success, "success")
  } catch (err) {
    notify(errorText(err), "danger")
  }
  await reload()
}

async function runNow(row: SyncJob) {
  await act(() => adminPost("/sync/job/run", undefined, { id: row.id }), t("adminSync.notices.started"))
}

async function dryRun(row: SyncJob) {
  try {
    const run = await adminPost<SyncRun>("/sync/job/dry_run", undefined, { id: row.id })
    if (run.state === "running") notify(t("adminSync.notices.dryRunRunning"), "info")
    history.value = { job: row, run: run.id }
  } catch (err) {
    notify(errorText(err), "danger")
  }
}

async function stop(row: SyncJob) {
  if (!row.last_run) return
  await act(() => adminPost("/sync/run/stop", undefined, { id: row.last_run!.id }), t("adminSync.notices.stopped"))
}

async function toggle(row: SyncJob) {
  await act(
    () => adminPost(row.enabled ? "/sync/job/disable" : "/sync/job/enable", undefined, { id: row.id }),
    t(row.enabled ? "adminSync.notices.disabled" : "adminSync.notices.enabled"),
  )
}

async function remove(row: SyncJob) {
  const attempted = await confirmDelete(row.name, () => adminPost("/sync/job/delete", undefined, { id: row.id }))
  if (!attempted) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const running = (row: SyncJob) => row.last_run?.state === "running"

const actionsFor = (row: SyncJob) => [
  running(row)
    ? { label: t("adminSync.actions.stop"), icon: stopIcon, danger: true, run: () => void stop(row) }
    : { label: t("adminSync.actions.run"), icon: syncIcon, run: () => void runNow(row) },
  { label: t("adminSync.actions.dryRun"), icon: dryRunIcon, disabled: running(row), run: () => void dryRun(row) },
  { label: t("adminSync.actions.history"), icon: historyIcon, run: () => (history.value = { job: row, run: null }) },
  { label: t(row.enabled ? "adminSync.actions.disable" : "adminSync.actions.enable"), icon: row.enabled ? pauseIcon : playIcon, run: () => void toggle(row) },
  { label: t("admin.actions.edit"), icon: icons.edit, run: () => openEdit(row) },
  { label: t("admin.actions.delete"), icon: icons.deleteIcon, danger: true, disabled: running(row), run: () => void remove(row) },
]

const scheduleOf = (row: SyncJob) =>
  row.schedule_kind === "interval" ? t("adminSync.schedule.every", { n: row.interval_min }) : t("adminSync.schedule.cron", { expr: row.cron })

function lastRunOf(row: SyncJob) {
  const run = row.last_run
  if (!run) return t("adminSync.schedule.none")
  return `${t(`adminSync.states.${run.state}`)} · ${formatDate(isoOf(run.finished_at ?? run.started_at))}`
}

const nextRunOf = (row: SyncJob) =>
  !row.enabled ? t("adminSync.schedule.disabled") : row.next_run_at ? formatDate(isoOf(row.next_run_at)) : t("adminSync.schedule.none")

function closeHistory() {
  history.value = null
  void reload()
}
</script>

<template>
  <AdminPage :description="t('adminSync.description')">
    <template v-if="!history" #actions>
      <FluentButton tone="primary" @click="openCreate">
        <FluentSvgIcon :svg="icons.add" :size="18" />
        {{ t("admin.actions.create") }}
      </FluentButton>
      <FluentButton tone="subtle" :disabled="loading" @click="reload">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("admin.actions.refresh") }}
      </FluentButton>
    </template>

    <SyncRuns v-if="history" :key="`${history.job.id}-${history.run}`" :job="history.job" :initial-run="history.run" @back="closeHistory" />

    <AdminTable
      v-else
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :empty-title="t('adminSync.empty')"
      :empty-detail="t('adminSync.emptyDetail')"
      @retry="reload"
    >
      <template #cell-route="{ row }">
        <span class="sync-route">{{ row.src }} → {{ row.dsts.join(", ") }}</span>
      </template>
      <template #cell-method="{ row }">
        {{ t(`adminSync.methods.${row.method}`) }}
      </template>
      <template #cell-schedule="{ row }">{{ scheduleOf(row) }}</template>
      <template #cell-lastRun="{ row }">
        <span :class="row.last_run ? `sync-state sync-state--${row.last_run.state}` : ''">{{ lastRunOf(row) }}</span>
      </template>
      <template #cell-nextRun="{ row }">{{ nextRunOf(row) }}</template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>

    <SyncJobPanel v-model:open="panelOpen" :job="editing" @saved="reload" />
  </AdminPage>
</template>

<style scoped>
.sync-route {
  overflow-wrap: anywhere;
}
.sync-state--failed,
.sync-state--partial {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
.sync-state--success {
  color: var(--fluent-success-text, var(--fluent-success));
}
</style>
