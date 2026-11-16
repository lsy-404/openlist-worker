<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { copyText } from "@/actions/builtin"
import AdminPage from "@/admin/components/AdminPage.vue"
import AdminRowActions from "@/admin/components/AdminRowActions.vue"
import AdminTable from "@/admin/components/AdminTable.vue"
import { confirmDelete } from "@/admin/confirm"
import { useAdminList } from "@/admin/useAdminList"
import { ApiError } from "@/api"
import { isAdmin } from "@/stores/session"
import { notify } from "@/stores/toast"
import { formatDate } from "@/utils/format"
import { icons } from "@/utils/icons"
import { shareApi, shareLink, shareState, type Share } from "./api"
import { askShare } from "./dialog"

const { t } = useI18n()
const { rows, loading, error, reload } = useAdminList(shareApi.list)

const columns = computed(() => [
  { key: "files", label: t("shares.columns.files") },
  ...(isAdmin.value ? [{ key: "creator", label: t("shares.columns.creator") }] : []),
  { key: "expires", label: t("shares.columns.expires") },
  { key: "accessed", label: t("shares.columns.accessed") },
  { key: "status", label: t("shares.columns.status") },
])

async function run(task: () => Promise<unknown>) {
  try {
    await task()
  } catch (err) {
    notify(err instanceof ApiError ? err.message : String(err), "danger")
  }
  await reload()
}

async function copy(share: Share) {
  notify((await copyText(shareLink(share.id))) ? t("files.notices.linkCopied") : t("files.notices.copyFailed"), "info")
}

async function edit(share: Share) {
  if (await askShare({ kind: "edit", share })) await reload()
}

async function remove(share: Share) {
  if (!(await confirmDelete(share.id, () => shareApi.remove(share.id)))) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const actionsFor = (share: Share) => [
  { label: t("shares.actions.copyLink"), icon: icons.link, run: () => void copy(share) },
  { label: t("shares.actions.open"), icon: icons.open, run: () => void window.open(shareLink(share.id), "_blank", "noopener") },
  {
    label: share.disabled ? t("shares.actions.enable") : t("shares.actions.disable"),
    icon: share.disabled ? icons.checkmark : icons.dismiss,
    run: () => void run(() => shareApi.setDisabled(share.id, !share.disabled)),
  },
  { label: t("shares.actions.edit"), icon: icons.edit, run: () => void edit(share) },
  { label: t("shares.actions.delete"), icon: icons.deleteIcon, danger: true, run: () => void remove(share) },
]
</script>

<template>
  <AdminPage :title="t('shares.title')">
    <template #actions>
      <FluentButton tone="subtle" :disabled="loading" @click="reload">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("shares.actions.refresh") }}
      </FluentButton>
    </template>

    <AdminTable :columns="columns" :rows="rows" :loading="loading" :error="error" :empty-title="t('shares.empty')" @retry="reload">
      <template #cell-files="{ row }">
        <span class="files">
          <span v-for="file in row.files" :key="file">{{ file }}</span>
        </span>
      </template>
      <template #cell-expires="{ row }">{{ row.expires ? formatDate(row.expires) : t("shares.never") }}</template>
      <template #cell-accessed="{ row }">{{ row.max_accessed > 0 ? `${row.accessed} / ${row.max_accessed}` : row.accessed }}</template>
      <template #cell-status="{ row }">
        <span class="badge" :class="shareState(row) === 'active' ? 'badge--on' : 'badge--off'">{{ t(`shares.status.${shareState(row)}`) }}</span>
        <FluentSvgIcon v-if="row.pwd" class="lock" :svg="icons.lockClosed" :size="16" :title="t('shares.status.password')" />
      </template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>
  </AdminPage>
</template>

<style scoped>
.files {
  display: flex;
  flex-direction: column;
}
.badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid currentColor;
}
.badge--on {
  color: var(--fluent-color-status-success-foreground-1, #107c10);
}
.badge--off {
  opacity: 0.7;
}
.lock {
  margin-inline-start: 6px;
  vertical-align: middle;
}
</style>
