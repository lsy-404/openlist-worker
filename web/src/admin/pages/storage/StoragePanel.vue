<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentField, FluentSelect } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminGet, adminPost } from "@/admin/api"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import AdminPanel from "@/admin/components/AdminPanel.vue"
import { notify } from "@/stores/toast"
import SchemaField from "./SchemaField.vue"
import {
  GENERAL_FIELDS,
  coerce,
  defaults,
  fromSource,
  helpText,
  humanize,
  isEmpty,
  parseAddition,
  type DriverField,
  type DriverInfo,
  type Storage,
  type Values,
} from "./types"

const props = defineProps<{ open: boolean; storage: Storage | null }>()
const emit = defineEmits<{ "update:open": [value: boolean]; saved: [] }>()

const { t, te } = useI18n()

const drivers = ref<Record<string, DriverInfo>>({})
const driversError = ref<string | null>(null)
const driver = ref("")
const driverFilter = ref("")
const common = reactive<Values>({})
const extra = reactive<Values>({})
const errors = reactive<Record<string, string>>({})
const saving = ref(false)
const formError = ref<string | null>(null)

const editing = computed(() => props.storage !== null)
const info = computed<DriverInfo | undefined>(() => drivers.value[driver.value])

const driverOptions = computed(() => {
  const needle = driverFilter.value.trim().toLowerCase()
  return Object.keys(drivers.value)
    .filter((name) => !needle || name.toLowerCase().includes(needle) || name === driver.value)
    .map((name) => ({ value: name, label: name }))
})

const generalFields = computed(() => (info.value?.common ?? []).filter((f) => GENERAL_FIELDS.includes(f.name)))
const advancedFields = computed(() => (info.value?.common ?? []).filter((f) => !GENERAL_FIELDS.includes(f.name)))
const driverFields = computed(() => info.value?.additional ?? [])

// Common fields have a fixed vocabulary and are translated; driver fields are humanised from the schema
function commonLabel(field: DriverField) {
  const key = `adminStorage.common.${field.name}`
  return te(key) ? t(key) : humanize(field.name)
}
function commonHelp(field: DriverField) {
  const key = `adminStorage.commonHelp.${field.name}`
  return te(key) ? t(key) : undefined
}
const driverLabel = (field: DriverField) => humanize(field.name) + (field.required && field.type !== "bool" ? " *" : "")

function clearState() {
  for (const key of Object.keys(errors)) delete errors[key]
  for (const key of Object.keys(common)) delete common[key]
  for (const key of Object.keys(extra)) delete extra[key]
}

function resetValues(next: DriverInfo, storage: Storage | null) {
  clearState()
  if (storage) {
    Object.assign(common, fromSource(next.common, storage))
    Object.assign(extra, fromSource(next.additional, parseAddition(storage.addition)))
  } else {
    Object.assign(common, defaults(next.common))
    Object.assign(extra, defaults(next.additional))
    common.mount_path = next.default_mount_path
  }
}

async function loadDrivers() {
  if (Object.keys(drivers.value).length) return
  try {
    drivers.value = await adminGet<Record<string, DriverInfo>>("/driver/list")
    driversError.value = null
  } catch (err) {
    driversError.value = err instanceof ApiError ? err.message : String(err)
  }
}

function chooseDriver(name: string) {
  const previousMount = info.value?.default_mount_path
  const keepMount = common.mount_path && common.mount_path !== previousMount ? String(common.mount_path) : ""
  driver.value = name
  const next = drivers.value[name]
  if (!next) return
  resetValues(next, null)
  if (keepMount) common.mount_path = keepMount
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    formError.value = null
    driverFilter.value = ""
    await loadDrivers()
    const storage = props.storage
    if (storage) {
      driver.value = storage.driver
      const next = drivers.value[storage.driver]
      if (next) resetValues(next, storage)
      else formError.value = driversError.value ?? t("adminStorage.unknownDriver", { driver: storage.driver })
    } else {
      driver.value = ""
      clearState()
      formError.value = driversError.value
    }
  },
)

function validate(): boolean {
  for (const key of Object.keys(errors)) delete errors[key]
  if (!driver.value) {
    formError.value = t("adminStorage.driverRequired")
    return false
  }
  for (const field of info.value?.common ?? []) {
    if (field.required && isEmpty(field, common[field.name])) errors[field.name] = t("adminStorage.required")
  }
  for (const field of driverFields.value) {
    if (field.required && isEmpty(field, extra[field.name])) errors[`a:${field.name}`] = t("adminStorage.required")
  }
  const bad = Object.keys(errors).length > 0
  if (bad) formError.value = t("adminStorage.fixErrors")
  return !bad
}

async function save() {
  formError.value = null
  if (!validate() || !info.value) return
  saving.value = true
  try {
    const typedCommon = Object.fromEntries(info.value.common.map((f) => [f.name, coerce(f, common[f.name])]))
    const addition = JSON.stringify({
      ...(props.storage ? parseAddition(props.storage.addition) : {}),
      ...Object.fromEntries(driverFields.value.map((f) => [f.name, coerce(f, extra[f.name])])),
    })
    if (props.storage) {
      await adminPost("/storage/update", { ...typedCommon, id: props.storage.id, driver: driver.value, addition })
    } else {
      await adminPost("/storage/create", { ...typedCommon, driver: driver.value, addition })
    }
    emit("update:open", false)
    notify(t("admin.notices.saved"), "success")
    emit("saved")
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : String(err)
    // A failed connection still stores the entry, so the list must reflect it
    emit("saved")
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminPanel
    :open="open"
    :title="editing ? t('adminStorage.panel.edit') : t('adminStorage.panel.create')"
    :busy="saving"
    :error="formError"
    @update:open="emit('update:open', $event)"
    @submit="save"
  >
    <section class="group">
      <h3 class="group__title">{{ t("adminStorage.sections.driver") }}</h3>
      <template v-if="!editing">
        <FluentField v-model="driverFilter" :label="t('adminStorage.driverSearch')" :placeholder="t('adminStorage.driverSearchHint')" />
        <FluentSelect
          :model-value="driver"
          :label="t('adminStorage.fields.driver')"
          :options="driverOptions"
          @update:model-value="chooseDriver"
        />
      </template>
      <AdminFormField v-else :model-value="driver" :label="t('adminStorage.fields.driver')" :help="t('adminStorage.driverLocked')" disabled />
    </section>

    <template v-if="info">
      <section class="group">
        <h3 class="group__title">{{ t("adminStorage.sections.general") }}</h3>
        <SchemaField
          v-for="field in generalFields"
          :key="field.name"
          v-model="common[field.name]"
          :field="field"
          :label="commonLabel(field) + (field.required ? ' *' : '')"
          :help="commonHelp(field)"
          :error="errors[field.name]"
        />
      </section>

      <section v-if="driverFields.length" class="group">
        <h3 class="group__title">{{ t("adminStorage.sections.driverSettings", { driver }) }}</h3>
        <SchemaField
          v-for="field in driverFields"
          :key="field.name"
          v-model="extra[field.name]"
          :field="field"
          :label="driverLabel(field)"
          :help="helpText(field)"
          :error="errors[`a:${field.name}`]"
        />
      </section>

      <section v-if="advancedFields.length" class="group">
        <h3 class="group__title">{{ t("adminStorage.sections.advanced") }}</h3>
        <SchemaField
          v-for="field in advancedFields"
          :key="field.name"
          v-model="common[field.name]"
          :field="field"
          :label="commonLabel(field)"
          :help="commonHelp(field)"
          :error="errors[field.name]"
        />
      </section>
    </template>
  </AdminPanel>
</template>

<style scoped>
.group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius, var(--fluent-radius));
}
.group__title {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
</style>
