<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentDialog, FluentField, FluentNotice, FluentNumberField, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { copyText } from "@/actions/builtin"
import { canCustomizeShareId } from "@/actions/permissions"
import { notify } from "@/stores/toast"
import { icons } from "@/utils/icons"
import { splitPath } from "@/utils/path"
import { shareApi, shareLink, type Share } from "./api"
import { activeShare, closeShare, type ShareRequest } from "./dialog"

const { t } = useI18n()
// The last request stays rendered while the dialog fades out
let last: ShareRequest | null = null
const request = computed(() => (last = activeShare.value ?? last))

const form = reactive({ pwd: "", expires: "", max: null as number | null, id: "" })
const created = ref<Share | null>(null)
const changed = ref(false)
const busy = ref(false)
const error = ref("")

const pad = (n: number) => String(n).padStart(2, "0")
function toLocal(iso: string | null): string {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return ""
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

watch(activeShare, (value) => {
  if (!value) return
  const share = value.kind === "edit" ? value.share : null
  Object.assign(form, { pwd: share?.pwd ?? "", expires: toLocal(share?.expires ?? null), max: share?.max_accessed || null, id: share?.id ?? "" })
  created.value = null
  changed.value = false
  busy.value = false
  error.value = ""
})

const title = computed(() => {
  const value = request.value
  if (!value) return ""
  if (value.kind === "edit") return t("shares.dialog.edit")
  const names = value.files.map((f) => splitPath(f).pop() ?? "/")
  return t("shares.dialog.create", { target: names.length === 1 ? t("files.target.one", { name: names[0] }) : t("files.target.many", { count: names.length }) })
})

async function submit() {
  const value = request.value
  if (!value || busy.value) return
  busy.value = true
  error.value = ""
  const settings = {
    pwd: form.pwd,
    expires: form.expires ? new Date(form.expires).toISOString() : null,
    max_accessed: form.max ?? 0,
  }
  try {
    if (value.kind === "create") {
      created.value = await shareApi.create({ ...settings, files: value.files, id: form.id.trim() || undefined })
      changed.value = true
    } else {
      const id = form.id.trim()
      await shareApi.update(value.share.id, { ...settings, new_id: id && id !== value.share.id ? id : undefined })
      value.settle(true)
      closeShare()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function close() {
  if (busy.value) return
  request.value?.settle(changed.value)
  closeShare()
}

async function copy() {
  if (created.value) notify((await copyText(shareLink(created.value.id))) ? t("files.notices.linkCopied") : t("files.notices.copyFailed"), "info")
}
</script>

<template>
  <FluentDialog :open="!!activeShare" :label="title" @close="close">
    <template #title>
      <h2 class="title">{{ title }}</h2>
    </template>

    <div v-if="created" class="body">
      <div class="link">
        <FluentField :model-value="shareLink(created.id)" :label="t('shares.dialog.link')" readonly @focus="($event.target as HTMLInputElement).select()" />
        <FluentButton :aria-label="t('shares.dialog.copy')" :title="t('shares.dialog.copy')" @click="copy">
          <FluentSvgIcon :svg="icons.copy" :size="20" />
        </FluentButton>
      </div>
    </div>

    <form v-else class="body" @submit.prevent="submit">
      <FluentField v-model="form.pwd" :label="t('shares.dialog.password')" autocomplete="off" spellcheck="false" />
      <FluentField v-model="form.expires" type="datetime-local" :label="t('shares.dialog.expires')" />
      <FluentNumberField v-model="form.max" :label="t('shares.dialog.maxAccessed')" :placeholder="t('shares.dialog.unlimited')" min="0" step="1" />
      <FluentField v-if="canCustomizeShareId()" v-model="form.id" :label="t('shares.dialog.id')" :placeholder="t('shares.dialog.idAuto')" autocomplete="off" spellcheck="false" />
      <FluentNotice v-if="error" tone="danger" role="alert">{{ error }}</FluentNotice>
      <button type="submit" hidden />
    </form>

    <template #footer>
      <FluentButton v-if="created" tone="primary" @click="close">{{ t("shares.dialog.done") }}</FluentButton>
      <template v-else>
        <FluentButton tone="primary" :busy="busy" @click="submit">
          {{ request?.kind === "edit" ? t("admin.panel.save") : t("shares.dialog.submit") }}
        </FluentButton>
        <FluentButton :disabled="busy" @click="close">{{ t("common.cancel") }}</FluentButton>
      </template>
    </template>
  </FluentDialog>
</template>

<style scoped>
.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(380px, 78vw);
  max-width: 100%;
}
.link {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}
.link :deep(.fluent-field) {
  flex: 1;
  min-width: 0;
}
</style>
