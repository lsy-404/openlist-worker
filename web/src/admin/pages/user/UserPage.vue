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
import {
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  ROLE_ADMIN,
  ROLE_GENERAL,
  ROLE_GUEST,
  bitsFromMask,
  emptyUser,
  maskFromBits,
  type User,
  type UserForm,
} from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList((signal) => adminList<User>("/user/list", undefined, signal))

const columns = computed(() => [
  { key: "username", label: t("adminUser.columns.username") },
  { key: "role", label: t("adminUser.columns.role") },
  { key: "base_path", label: t("adminUser.columns.basePath") },
  { key: "status", label: t("adminUser.columns.status") },
  { key: "sso", label: t("adminUser.columns.sso") },
  { key: "permission", label: t("adminUser.columns.permission") },
])

const roleLabel = (role: number) =>
  t(role === ROLE_ADMIN ? "adminUser.roles.admin" : role === ROLE_GUEST ? "adminUser.roles.guest" : "adminUser.roles.user")
const permissionSummary = (row: User) =>
  row.role === ROLE_ADMIN
    ? t("adminUser.permissionAll")
    : row.role === ROLE_GUEST
      ? t("adminUser.permissionNone")
      : t("adminUser.permissionCount", { count: bitsFromMask(row.permission).filter(Boolean).length, total: PERMISSION_KEYS.length })

const panelOpen = ref(false)
const editing = ref<User | null>(null)
const form = reactive<UserForm>(emptyUser())
const saving = ref(false)
const formError = ref<string | null>(null)
const nameError = ref<string | undefined>()

const role = computed(() => editing.value?.role ?? ROLE_GENERAL)

function openCreate() {
  editing.value = null
  Object.assign(form, emptyUser())
  formError.value = null
  nameError.value = undefined
  panelOpen.value = true
}

function openEdit(row: User) {
  editing.value = row
  Object.assign(form, emptyUser(), {
    username: row.username,
    base_path: row.base_path,
    disabled: row.disabled,
    sso_id: row.sso_id,
    bits: bitsFromMask(row.permission),
  })
  formError.value = null
  nameError.value = undefined
  panelOpen.value = true
}

async function save() {
  if (!form.username.trim()) {
    nameError.value = t("adminUser.fields.usernameRequired")
    return
  }
  nameError.value = undefined
  saving.value = true
  formError.value = null
  try {
    const body: Record<string, unknown> = {
      username: form.username.trim(),
      base_path: form.base_path.trim() || "/",
      disabled: form.disabled,
      sso_id: form.sso_id.trim(),
    }
    if (form.password) body.password = form.password
    if (role.value === ROLE_GENERAL) body.permission = maskFromBits(form.bits)
    const user = editing.value
    await adminPost(user ? "/user/update" : "/user/create", user ? { ...body, id: user.id } : body)
    panelOpen.value = false
    notify(t("admin.notices.saved"), "success")
    await reload()
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function runAction(path: string, body: unknown, query: Record<string, number> | undefined, done: string) {
  try {
    await adminPost(path, body, query)
    notify(done, "success")
  } catch (err) {
    notify(err instanceof ApiError ? err.message : String(err), "danger")
  }
  await reload()
}

async function remove(row: User) {
  const attempted = await confirmDelete(row.username, () => adminPost("/user/delete", undefined, { id: row.id }))
  if (!attempted) return
  notify(t("admin.notices.deleted"), "success")
  await reload()
}

const actionsFor = (row: User) => [
  { label: t("admin.actions.edit"), icon: icons.edit, run: () => openEdit(row) },
  {
    label: row.disabled ? t("adminUser.actions.enable") : t("adminUser.actions.disable"),
    icon: row.disabled ? icons.checkmark : icons.dismiss,
    disabled: row.role === ROLE_ADMIN && !row.disabled,
    run: () => void runAction("/user/update", { id: row.id, disabled: !row.disabled }, undefined, t("admin.notices.saved")),
  },
  {
    label: t("adminUser.actions.cancelTwoFactor"),
    icon: icons.lockClosed,
    disabled: !row.otp,
    run: () => void runAction("/user/cancel_2fa", undefined, { id: row.id }, t("adminUser.twoFactorCancelled")),
  },
  {
    label: t("admin.actions.delete"),
    icon: icons.deleteIcon,
    danger: true,
    disabled: row.role !== ROLE_GENERAL,
    run: () => void remove(row),
  },
]
</script>

<template>
  <AdminPage :description="t('adminUser.description')">
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

    <AdminTable :columns="columns" :rows="rows" :loading="loading" :error="error" :empty-title="t('adminUser.empty')" @retry="reload">
      <template #cell-role="{ row }">{{ roleLabel(row.role) }}</template>
      <template #cell-status="{ row }">
        <span class="badge" :class="row.disabled ? 'badge--off' : 'badge--on'">
          {{ row.disabled ? t("adminUser.disabled") : t("adminUser.enabled") }}
        </span>
      </template>
      <template #cell-sso="{ row }">{{ row.sso_id ? t("adminUser.ssoBound") : t("adminUser.ssoUnbound") }}</template>
      <template #cell-permission="{ row }">{{ permissionSummary(row) }}</template>
      <template #actions="{ row }"><AdminRowActions :items="actionsFor(row)" /></template>
    </AdminTable>

    <AdminPanel
      v-model:open="panelOpen"
      :title="editing ? t('adminUser.panel.edit') : t('adminUser.panel.create')"
      :busy="saving"
      :error="formError"
      @submit="save"
    >
      <h3 class="section">{{ t("adminUser.sections.account") }}</h3>
      <AdminFormField v-model="form.username" :label="t('adminUser.fields.username')" :error="nameError" />
      <AdminFormField
        v-model="form.password"
        kind="password"
        :label="t('adminUser.fields.password')"
        :help="editing ? t('adminUser.fields.passwordHelpEdit') : t('adminUser.fields.passwordHelp')"
      />
      <AdminFormField
        :model-value="roleLabel(role)"
        readonly
        :label="t('adminUser.fields.role')"
        :help="t('adminUser.fields.roleHelp')"
      />
      <AdminFormField v-model="form.disabled" kind="switch" :label="t('adminUser.fields.disabled')" :disabled="role === ROLE_ADMIN" />

      <h3 class="section">{{ t("adminUser.sections.access") }}</h3>
      <AdminFormField v-model="form.base_path" :label="t('adminUser.fields.basePath')" :help="t('adminUser.fields.basePathHelp')" />
      <AdminFormField v-model="form.sso_id" :label="t('adminUser.fields.ssoId')" :help="t('adminUser.fields.ssoIdHelp')" />

      <template v-if="role === ROLE_GENERAL">
        <template v-for="group in PERMISSION_GROUPS" :key="group.key">
          <h3 class="section">{{ t(`adminUser.groups.${group.key}`) }}</h3>
          <AdminFormField
            v-for="bit in group.bits"
            :key="bit"
            v-model="form.bits[bit]"
            kind="switch"
            :label="t(`adminUser.permissions.${PERMISSION_KEYS[bit]}`)"
          />
        </template>
      </template>
      <p v-else class="note">{{ t("adminUser.permissionFixed") }}</p>
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
</style>
