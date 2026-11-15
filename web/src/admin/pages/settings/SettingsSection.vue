<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentNotice } from "@platform-kit/fluent/vue"
import { ApiError } from "@/api"
import { adminPost } from "@/admin/api"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import { askConfirm } from "@/stores/dialogs"
import { notify } from "@/stores/toast"
import { humanize, isSecretKey, NO_RESET_GROUPS, type Setting } from "./types"

const props = defineProps<{ items: Setting[]; group: number | null; description?: string }>()
const emit = defineEmits<{ saved: [] }>()

const { t, te } = useI18n()

const drafts = reactive<Record<string, string>>({})
const saving = ref(false)
const error = ref<string | null>(null)

const isReadonly = (item: Setting) => item.flag === 1

function resetDrafts() {
  for (const key of Object.keys(drafts)) delete drafts[key]
  for (const item of props.items) drafts[item.key] = item.value ?? ""
  error.value = null
}
watch(() => props.items, resetDrafts, { immediate: true })

const dirtyItems = computed(() => props.items.filter((item) => !isReadonly(item) && drafts[item.key] !== (item.value ?? "")))
const canReset = computed(() => props.group !== null && !NO_RESET_GROUPS.has(props.group))

function label(item: Setting): string {
  const path = `adminSettings.keys.${item.key}`
  return te(path) ? t(path) : humanize(item.key)
}

function kindOf(item: Setting) {
  if (item.type === "bool") return "switch"
  if (item.type === "number") return "number"
  if (item.type === "select") return "select"
  if (item.type === "text") return "textarea"
  return isSecretKey(item.key) ? "password" : "text"
}

function optionsOf(item: Setting) {
  return (item.options ?? "")
    .split(",")
    .filter(Boolean)
    .map((value) => ({ value, label: value }))
}

function modelOf(item: Setting): string | number | boolean | null {
  const value = drafts[item.key] ?? ""
  if (item.type === "bool") return value === "true"
  if (item.type === "number") return value === "" || Number.isNaN(Number(value)) ? null : Number(value)
  return value
}

function setDraft(item: Setting, value: unknown) {
  drafts[item.key] = value == null ? "" : String(value)
}

async function save() {
  saving.value = true
  error.value = null
  try {
    await adminPost(
      "/setting/save",
      dirtyItems.value.map((item) => ({ key: item.key, value: drafts[item.key] })),
    )
    notify(t("admin.notices.saved"), "success")
    emit("saved")
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

async function resetToDefaults() {
  const attempted = await askConfirm({
    title: t("adminSettings.reset.title"),
    message: t("adminSettings.reset.message"),
    confirmLabel: t("adminSettings.reset.confirm"),
    danger: true,
    async run() {
      await adminPost("/setting/default", undefined, { group: props.group ?? undefined })
    },
  })
  if (!attempted) return
  notify(t("adminSettings.reset.done"), "success")
  emit("saved")
}
</script>

<template>
  <div class="section">
    <p v-if="description" class="section__desc">{{ description }}</p>
    <slot name="before" />
    <FluentNotice v-if="error" tone="danger">{{ error }}</FluentNotice>
    <form class="section__form" @submit.prevent="save">
      <div v-for="item in items" :key="item.key" class="section__field">
        <AdminFormField
          :model-value="modelOf(item)"
          :kind="kindOf(item)"
          :label="label(item)"
          :help="item.help && item.help !== item.key ? item.help : undefined"
          :options="optionsOf(item)"
          :disabled="isReadonly(item) || saving"
          :rows="kindOf(item) === 'textarea' ? 3 : undefined"
          @update:model-value="setDraft(item, $event)"
        />
        <span v-if="isReadonly(item)" class="section__flag">{{ t("adminSettings.readonly") }}</span>
      </div>
      <div class="section__foot">
        <FluentButton tone="primary" type="submit" :busy="saving" :disabled="!dirtyItems.length">{{ t("admin.panel.save") }}</FluentButton>
        <FluentButton type="button" :disabled="saving || !dirtyItems.length" @click="resetDrafts">{{ t("adminSettings.discard") }}</FluentButton>
        <span v-if="dirtyItems.length" class="section__dirty">{{ t("adminSettings.unsaved", { n: dirtyItems.length }) }}</span>
        <FluentButton v-if="canReset" class="section__reset" tone="subtle" type="button" :disabled="saving" @click="resetToDefaults">
          {{ t("adminSettings.reset.action") }}
        </FluentButton>
      </div>
    </form>
  </div>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section__desc {
  margin: 0;
  color: var(--fluent-muted);
}
.section__form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section__field {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.section__flag {
  font-size: 0.75rem;
  color: var(--fluent-muted);
}
.section__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--fluent-border);
}
.section__dirty {
  font-size: 0.85rem;
  color: var(--fluent-muted);
}
.section__reset {
  margin-left: auto;
}
</style>
