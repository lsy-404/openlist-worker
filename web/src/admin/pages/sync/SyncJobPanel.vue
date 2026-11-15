<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentNotice, FluentSegmented } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminPost } from "@/admin/api"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import AdminPanel from "@/admin/components/AdminPanel.vue"
import { notify } from "@/stores/toast"
import { formatDate } from "@/utils/format"
import { emptyJob, isoOf, type SyncJob, type SyncJobForm } from "./types"

const props = defineProps<{ job: SyncJob | null }>()
const open = defineModel<boolean>("open", { required: true })
const emit = defineEmits<{ saved: [] }>()

const { t } = useI18n()

const form = reactive<SyncJobForm>(emptyJob())
const dstText = ref("")
const saving = ref(false)
const formError = ref<string | null>(null)
const errors = reactive<Record<string, string | undefined>>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, emptyJob(), props.job ? structuredClone({ ...props.job }) : {})
  dstText.value = form.dsts.join("\n")
  formError.value = null
  for (const key of Object.keys(errors)) errors[key] = undefined
})

const methodOptions = computed(() =>
  (["copy", "mirror", "move"] as const).map((value) => ({ value, label: t(`adminSync.methods.${value}`) })),
)
const kindOptions = computed(() => [
  { value: "interval", label: t("adminSync.fields.interval") },
  { value: "cron", label: t("adminSync.fields.cronKind") },
])

const normalize = (p: string) => "/" + p.split("/").filter(Boolean).join("/")
const inside = (a: string, b: string) => b === "/" || a === b || a.startsWith(b + "/")

function validate(): boolean {
  for (const key of Object.keys(errors)) errors[key] = undefined
  if (!form.name.trim()) errors.name = t("adminSync.fields.nameRequired")
  const src = form.src.trim()
  if (!src) errors.src = t("adminSync.fields.pathRequired")
  else if (!src.startsWith("/") || normalize(src) === "/") errors.src = t("adminSync.fields.pathInvalid")
  const dsts = dstText.value
    .split("\n")
    .map((d) => d.trim())
    .filter(Boolean)
  if (dsts.length === 0) errors.dsts = t("adminSync.fields.pathRequired")
  else if (dsts.some((d) => !d.startsWith("/") || normalize(d) === "/")) errors.dsts = t("adminSync.fields.pathInvalid")
  else if (src && dsts.some((d) => inside(normalize(d), normalize(src)) || inside(normalize(src), normalize(d))))
    errors.dsts = t("adminSync.fields.overlap")
  if (form.method === "move" && !form.allow_delete) errors.allowDelete = t("adminSync.fields.moveNeedsDelete")
  if (form.schedule_kind === "interval") {
    const n = form.interval_min
    if (!Number.isInteger(n) || n < 1 || n > 525600) errors.interval = t("adminSync.fields.intervalInvalid")
  }
  form.dsts = dsts
  return !Object.values(errors).some(Boolean)
}

const preview = ref<number[]>([])
const previewError = ref<string | null>(null)
let previewTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => [open.value, form.schedule_kind, form.cron, form.interval_min, form.timezone] as const,
  ([isOpen]) => {
    clearTimeout(previewTimer)
    if (!isOpen) return
    previewTimer = setTimeout(async () => {
      try {
        const res = await adminPost<{ next: number[] }>("/sync/schedule/preview", {
          schedule_kind: form.schedule_kind,
          interval_min: form.interval_min,
          cron: form.cron,
          timezone: form.timezone,
        })
        preview.value = res.next
        previewError.value = null
      } catch (err) {
        preview.value = []
        previewError.value = err instanceof ApiError ? err.message : String(err)
      }
    }, 300)
  },
  { immediate: true },
)

async function save() {
  if (!validate()) return
  saving.value = true
  formError.value = null
  try {
    const body = { ...form, name: form.name.trim(), src: form.src.trim() }
    await adminPost(props.job ? "/sync/job/update" : "/sync/job/create", props.job ? { ...body, id: props.job.id } : body)
    open.value = false
    notify(t("admin.notices.saved"), "success")
    emit("saved")
  } catch (err) {
    formError.value = err instanceof ApiError ? err.message : String(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminPanel
    v-model:open="open"
    :title="job ? t('adminSync.panel.edit') : t('adminSync.panel.create')"
    :busy="saving"
    :error="formError"
    @submit="save"
  >
    <AdminFormField v-model="form.name" :label="t('adminSync.fields.name')" :error="errors.name" />
    <AdminFormField v-model="form.src" :label="t('adminSync.fields.src')" :help="t('adminSync.fields.srcHelp')" :error="errors.src" />
    <AdminFormField v-model="dstText" kind="textarea" rows="3" :label="t('adminSync.fields.dsts')" :help="t('adminSync.fields.dstsHelp')" :error="errors.dsts" />
    <AdminFormField
      v-model="form.method"
      kind="select"
      :options="methodOptions"
      :label="t('adminSync.fields.method')"
      :help="t(`adminSync.methodHelp.${form.method}`)"
    />
    <AdminFormField v-model="form.allow_delete" kind="switch" :label="t('adminSync.fields.allowDelete')" :error="errors.allowDelete" />
    <FluentNotice v-if="form.allow_delete || form.method !== 'copy'" tone="warning">{{ t("adminSync.fields.allowDeleteWarn") }}</FluentNotice>
    <AdminFormField v-model="form.exclude" kind="textarea" rows="3" :label="t('adminSync.fields.exclude')" :help="t('adminSync.fields.excludeHelp')" />

    <FluentSegmented v-model="form.schedule_kind" :options="kindOptions" :label="t('adminSync.fields.scheduleKind')" />
    <AdminFormField
      v-if="form.schedule_kind === 'interval'"
      v-model="form.interval_min"
      kind="number"
      :label="t('adminSync.fields.intervalMin')"
      :error="errors.interval"
    />
    <template v-else>
      <AdminFormField v-model="form.cron" :label="t('adminSync.fields.cron')" :help="t('adminSync.fields.cronHelp')" />
      <AdminFormField v-model="form.timezone" :label="t('adminSync.fields.timezone')" />
    </template>
    <div class="sync-preview" aria-live="polite">
      <p class="sync-preview__title">{{ t("adminSync.fields.preview") }}</p>
      <p v-if="previewError" class="sync-preview__error">{{ previewError }}</p>
      <p v-else-if="form.schedule_kind === 'interval'">{{ t("adminSync.fields.previewInterval", { n: form.interval_min }) }}</p>
      <ul v-else>
        <li v-for="ms in preview" :key="ms">{{ formatDate(isoOf(ms)) }}</li>
      </ul>
    </div>
  </AdminPanel>
</template>

<style scoped>
.sync-preview {
  padding: 8px 12px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
  font-size: 0.9rem;
}
.sync-preview p,
.sync-preview ul {
  margin: 0;
}
.sync-preview ul {
  padding-inline-start: 18px;
}
.sync-preview__title {
  font-weight: 600;
  margin-bottom: 4px !important;
}
.sync-preview__error {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
</style>
