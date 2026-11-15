<script setup lang="ts">
import { computed, reactive, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminList, adminPost } from "@/admin/api"
import { confirmDelete } from "@/admin/confirm"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import AdminPage from "@/admin/components/AdminPage.vue"
import AdminPanel from "@/admin/components/AdminPanel.vue"
import AdminRowActions from "@/admin/components/AdminRowActions.vue"
import AdminTable from "@/admin/components/AdminTable.vue"
import { useAdminList } from "@/admin/useAdminList"
import { notify } from "@/stores/toast"
import { icons } from "@/utils/icons"
import { emptyMeta, type Meta, type MetaForm } from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList((signal) => adminList<Meta>("/meta/list", undefined, signal))

const columns = computed(() => [
  { key: "path", label: t("adminMeta.columns.path") },
  { key: "password", label: t("adminMeta.columns.password") },
  { key: "write", label: t("adminMeta.columns.write") },
  { key: "hide", label: t("adminMeta.columns.hide") },
])
const yesNo = (value: unknown) => (value ? t("adminMeta.yes") : t("adminMeta.no"))

const panelOpen = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<MetaForm>(emptyMeta())
const saving = ref(false)
const formError = ref<string | null>(null)
const pathError = ref<string | undefined>()

function openCreate() {
  editingId.value = null
  Object.assign(form, emptyMeta())
  formError.value = null
  pathError.value = undefined
  panelOpen.value = true
}

function openEdit(row: Meta) {
  editingId.value = row.id
  Object.assign(form, emptyMeta(), row)
  formError.value = null
  pathError.value = undefined
  panelOpen.value = true
}

async function save() {
  if (!form.path.replaceAll("/", "").trim()) {
    pathError.value = t("adminMeta.fields.pathRequired")
    return
  }
  pathError.value = undefined
  saving.value = true
  formError.value = null
  try {
    const id = editingId.value
    await adminPost(id === null ? "/meta/create" : "/meta/update", id === null ? form : { ...form, id })
    panelOpen.value = false
    notify(t("admin.notices.saved"), "success")
    await reload()
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function remove(row: Meta) {
  const attempted = await confirmDelete(row.path, () => adminPost("/meta/delete", undefined, { id: row.id }))
  if (!attempted) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const actionsFor = (row: Meta) => [
  { label: t("admin.actions.edit"), icon: icons.edit, run: () => openEdit(row) },
  { label: t("admin.actions.delete"), icon: icons.deleteIcon, danger: true, run: () => void remove(row) },
]
</script>

<template>
  <AdminPage :description="t('adminMeta.description')">
    <template #actions>
      <FluentButton tone="primary" @click="openCreate">
        <FluentSvgIcon :svg="icons.add" :size="18" />
        {{ t("admin.actions.create") }}
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
      :empty-title="t('adminMeta.empty')"
      :empty-detail="t('adminMeta.emptyDetail')"
      @retry="reload"
    >
      <template #cell-password="{ row }">{{ yesNo(row.password) }}</template>
      <template #cell-write="{ row }">{{ yesNo(row.write) }}</template>
      <template #cell-hide="{ row }">{{ row.hide ? row.hide.split("\n").filter(Boolean).length : "-" }}</template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>

    <AdminPanel
      v-model:open="panelOpen"
      :title="editingId === null ? t('adminMeta.panel.create') : t('adminMeta.panel.edit')"
      :busy="saving"
      :error="formError"
      @submit="save"
    >
      <AdminFormField v-model="form.path" :label="t('adminMeta.fields.path')" :help="t('adminMeta.fields.pathHelp')" :error="pathError" />
      <AdminFormField v-model="form.password" kind="password" :label="t('adminMeta.fields.password')" :help="t('adminMeta.fields.passwordHelp')" />
      <AdminFormField v-model="form.p_sub" kind="switch" :label="t('adminMeta.fields.applyToSub')" />
      <AdminFormField v-model="form.write" kind="switch" :label="t('adminMeta.fields.write')" />
      <AdminFormField v-model="form.w_sub" kind="switch" :label="t('adminMeta.fields.applyToSub')" />
      <AdminFormField v-model="form.hide" kind="textarea" rows="4" :label="t('adminMeta.fields.hide')" :help="t('adminMeta.fields.hideHelp')" />
      <AdminFormField v-model="form.h_sub" kind="switch" :label="t('adminMeta.fields.applyToSub')" />
      <AdminFormField v-model="form.readme" kind="textarea" rows="4" :label="t('adminMeta.fields.readme')" :help="t('adminMeta.fields.readmeHelp')" />
      <AdminFormField v-model="form.r_sub" kind="switch" :label="t('adminMeta.fields.applyToSub')" />
    </AdminPanel>
  </AdminPage>
</template>
