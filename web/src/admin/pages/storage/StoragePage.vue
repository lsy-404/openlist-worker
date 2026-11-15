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
import { icons } from "@/utils/icons"
import { pauseIcon, playIcon, reloadIcon } from "./icons"
import StoragePanel from "./StoragePanel.vue"
import { statusOf, type Storage } from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList((signal) => adminList<Storage>("/storage/list", undefined, signal))

const columns = computed(() => [
  { key: "mount_path", label: t("adminStorage.columns.mountPath") },
  { key: "driver", label: t("adminStorage.columns.driver") },
  { key: "status", label: t("adminStorage.columns.status") },
  { key: "order", label: t("adminStorage.columns.order") },
  { key: "remark", label: t("adminStorage.columns.remark") },
])

const panelOpen = ref(false)
const editing = ref<Storage | null>(null)

function openCreate() {
  editing.value = null
  panelOpen.value = true
}

function openEdit(row: Storage) {
  editing.value = row
  panelOpen.value = true
}

const reloading = ref(false)

async function reloadAll() {
  reloading.value = true
  try {
    const result = await adminPost<{ loaded: number; failed: number }>("/storage/load_all")
    notify(t("adminStorage.reloaded", { loaded: result.loaded, failed: result.failed }), result.failed ? "danger" : "success")
    await reload()
  } catch (err) {
    notify(err instanceof ApiError ? err.message : String(err), "danger")
  } finally {
    reloading.value = false
  }
}

async function toggle(row: Storage) {
  try {
    await adminPost(row.disabled ? "/storage/enable" : "/storage/disable", undefined, { id: row.id })
    notify(t(row.disabled ? "adminStorage.enabled" : "adminStorage.disabled"), "success")
  } catch (err) {
    notify(err instanceof ApiError ? err.message : String(err), "danger")
  }
  await reload()
}

async function remove(row: Storage) {
  const attempted = await confirmDelete(row.mount_path, () => adminPost("/storage/delete", undefined, { id: row.id }))
  if (!attempted) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const actionsFor = (row: Storage) => [
  { label: t("admin.actions.edit"), icon: icons.edit, run: () => openEdit(row) },
  {
    label: t(row.disabled ? "adminStorage.actions.enable" : "adminStorage.actions.disable"),
    icon: row.disabled ? playIcon : pauseIcon,
    run: () => void toggle(row),
  },
  { label: t("admin.actions.delete"), icon: icons.deleteIcon, danger: true, run: () => void remove(row) },
]
</script>

<template>
  <AdminPage :description="t('adminStorage.description')">
    <template #actions>
      <FluentButton tone="primary" @click="openCreate">
        <FluentSvgIcon :svg="icons.add" :size="18" />
        {{ t("admin.actions.create") }}
      </FluentButton>
      <FluentButton :disabled="reloading" @click="reloadAll">
        <FluentSvgIcon :svg="reloadIcon" :size="18" />
        {{ t("adminStorage.actions.reloadAll") }}
      </FluentButton>
      <FluentButton tone="subtle" :disabled="loading" @click="reload">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("admin.actions.refresh") }}
      </FluentButton>
    </template>

    <AdminTable
      :columns="columns"
      :rows="rows"
      :loading="loading"
      :error="error"
      :empty-title="t('adminStorage.empty')"
      :empty-detail="t('adminStorage.emptyDetail')"
      @retry="reload"
    >
      <template #cell-status="{ row }">
        <span class="badge" :class="`badge--${statusOf(row)}`">{{ t(`adminStorage.status.${statusOf(row)}`) }}</span>
        <p v-if="statusOf(row) === 'error'" class="status-detail">{{ row.status }}</p>
      </template>
      <template #cell-order="{ row }">{{ row.order || 0 }}</template>
      <template #cell-remark="{ row }">{{ row.remark || "-" }}</template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>

    <StoragePanel v-model:open="panelOpen" :storage="editing" @saved="reload" />
  </AdminPage>
</template>

<style scoped>
.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  background: var(--badge-bg);
  color: var(--badge-fg);
}
.badge--working {
  --badge-bg: #dff6dd;
  --badge-fg: #0e700e;
}
.badge--error {
  --badge-bg: #fde7e9;
  --badge-fg: #a4262c;
}
.badge--disabled {
  --badge-bg: var(--fluent-control-hover);
  --badge-fg: var(--fluent-muted);
}
[data-fluent-theme="dark"] .badge--working {
  --badge-bg: #1b3a1b;
  --badge-fg: #6ccb5f;
}
[data-fluent-theme="dark"] .badge--error {
  --badge-bg: #442726;
  --badge-fg: #f1707b;
}
.status-detail {
  margin: 4px 0 0;
  max-width: 36ch;
  font-size: 0.8rem;
  color: var(--fluent-danger-text, var(--fluent-danger));
}
</style>
