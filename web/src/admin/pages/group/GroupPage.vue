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
import { maskFromBits } from "../user/types"
import ScopesEditor from "./ScopesEditor.vue"
import { emptyGroup, scopeToForm, type Group, type GroupForm } from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList(async (signal) => {
  const [groups, users] = await Promise.all([
    adminList<Group>("/group/list", undefined, signal),
    adminList<{ groups?: number[] }>("/user/list", undefined, signal),
  ])
  const counts = new Map<number, number>()
  for (const user of users) for (const id of user.groups ?? []) counts.set(id, (counts.get(id) ?? 0) + 1)
  return groups.map((group) => ({ ...group, members: counts.get(group.id) ?? 0 }))
})

const columns = computed(() => [
  { key: "name", label: t("adminGroup.columns.name") },
  { key: "description", label: t("adminGroup.columns.description") },
  { key: "scopes", label: t("adminGroup.columns.scopes") },
  { key: "members", label: t("adminGroup.columns.members") },
])

const panelOpen = ref(false)
const editing = ref<Group | null>(null)
const form = reactive<GroupForm>(emptyGroup())
const saving = ref(false)
const formError = ref<string | null>(null)
const nameError = ref<string | undefined>()

function openCreate() {
  editing.value = null
  Object.assign(form, emptyGroup())
  formError.value = null
  nameError.value = undefined
  panelOpen.value = true
}

function openEdit(row: Group) {
  editing.value = row
  Object.assign(form, { name: row.name, description: row.description, scopes: row.scopes.map(scopeToForm) })
  formError.value = null
  nameError.value = undefined
  panelOpen.value = true
}

async function save() {
  if (!form.name.trim()) {
    nameError.value = t("adminGroup.fields.nameRequired")
    return
  }
  nameError.value = undefined
  saving.value = true
  formError.value = null
  try {
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      scopes: form.scopes.map((scope) => ({ path: scope.path.trim() || "/", permission: maskFromBits(scope.bits) })),
    }
    const group = editing.value
    await adminPost(group ? "/group/update" : "/group/create", group ? { ...body, id: group.id } : body)
    panelOpen.value = false
    notify(t("admin.notices.saved"), "success")
    await reload()
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function remove(row: Group) {
  const attempted = await confirmDelete(row.name, () => adminPost("/group/delete", undefined, { id: row.id }))
  if (!attempted) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const actionsFor = (row: Group) => [
  { label: t("admin.actions.edit"), icon: icons.edit, run: () => openEdit(row) },
  { label: t("admin.actions.delete"), icon: icons.deleteIcon, danger: true, run: () => void remove(row) },
]
</script>

<template>
  <AdminPage :description="t('adminGroup.description')">
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
      :empty-title="t('adminGroup.empty')"
      :empty-detail="t('adminGroup.emptyDetail')"
      @retry="reload"
    >
      <template #cell-scopes="{ row }">{{ row.scopes.map((scope: { path: string }) => scope.path).join(", ") || "-" }}</template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>

    <AdminPanel
      v-model:open="panelOpen"
      :title="editing ? t('adminGroup.panel.edit') : t('adminGroup.panel.create')"
      :busy="saving"
      :error="formError"
      @submit="save"
    >
      <AdminFormField v-model="form.name" :label="t('adminGroup.fields.name')" :error="nameError" />
      <AdminFormField v-model="form.description" kind="textarea" rows="2" :label="t('adminGroup.fields.description')" />
      <h3 class="section">{{ t("adminGroup.sections.scopes") }}</h3>
      <p class="note">{{ t("adminGroup.scopes.help") }}</p>
      <ScopesEditor v-model="form.scopes" />
    </AdminPanel>
  </AdminPage>
</template>

<style scoped>
.section {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 600;
}
.note {
  margin: 0;
  font-size: 13px;
  opacity: 0.8;
}
</style>
