<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue"
import { onBeforeRouteLeave, onBeforeRouteUpdate } from "vue-router"
import { FluentButton, FluentSvgIcon, FluentToggleButton } from "@platform-kit/fluent/vue"
import { uploadFile } from "@/api/upload"
import { resolvedTheme } from "@/stores/prefs"
import { notify } from "@/stores/toast"
import { formatSize } from "@/utils/format"
import { parentPath } from "@/utils/path"
import type { EditorHandle } from "./codemirror"
import { invalidateFolder, useWritable } from "./folder"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { previewIcons } from "./icons"
import type { PreviewProps } from "./registry"
import { useTextFile } from "./useTextFile"

/** Files above this size are not opened for editing at all. */
const EDIT_LIMIT = 5 * 1024 * 1024

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, text, encoding, error, load } = useTextFile(() => ({ url: props.downloadUrl, size: props.file.size }))
const writable = useWritable(() => props.path)

const host = ref<HTMLElement>()
const editor = shallowRef<EditorHandle | null>(null)
const wrap = ref(true)
const dirty = ref(false)
const saving = ref(false)
const saveError = ref("")

const tooLarge = computed(() => props.file.size > EDIT_LIMIT)
// Saving re-encodes as UTF-8, which would corrupt a file read in another encoding
const readOnly = computed(() => !writable.value || encoding.value !== "UTF-8")
const readOnlyReason = computed(() =>
  encoding.value !== "UTF-8" ? t("preview.editor.encodingLocked", { encoding: encoding.value }) : t("preview.editor.readOnly"),
)

async function mount() {
  editor.value?.destroy()
  editor.value = null
  dirty.value = false
  await Promise.resolve()
  if (status.value !== "ready" || !host.value) return
  const { createEditor } = await import("./codemirror")
  if (status.value !== "ready" || !host.value) return
  editor.value = await createEditor({
    parent: host.value,
    doc: text.value,
    name: props.file.name,
    readOnly: readOnly.value,
    wrap: wrap.value,
    dark: resolvedTheme.value === "dark",
    onChange: () => (dirty.value = true),
    onSave: () => void save(),
  })
}

watch(status, () => void mount(), { flush: "post" })
watch(wrap, (value) => editor.value?.setWrap(value))
watch(readOnly, (value) => editor.value?.setReadOnly(value))
watch(resolvedTheme, (mode) => editor.value?.setDark(mode === "dark"))

async function save() {
  const handle = editor.value
  if (!handle || readOnly.value || !dirty.value || saving.value) return
  saving.value = true
  saveError.value = ""
  const content = handle.getText()
  try {
    const blob = new File([content], props.file.name, { type: "text/plain;charset=utf-8" })
    await uploadFile(props.path, blob, { signal: new AbortController().signal, onProgress: () => undefined })
    invalidateFolder(parentPath(props.path))
    text.value = content
    dirty.value = false
    notify(t("preview.editor.saved"), "success")
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err)
  } finally {
    saving.value = false
  }
}

function revert() {
  editor.value?.setText(text.value)
  dirty.value = false
  saveError.value = ""
}

function confirmLeave(): boolean {
  return !dirty.value || window.confirm(t("preview.editor.discard"))
}
onBeforeRouteLeave(confirmLeave)
onBeforeRouteUpdate(confirmLeave)

function beforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener("beforeunload", beforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener("beforeunload", beforeUnload)
  editor.value?.destroy()
})
</script>

<template>
  <div class="editor">
    <PreviewNotice
      v-if="tooLarge"
      tone="info"
      :title="t('preview.editor.tooLargeTitle')"
      :detail="t('preview.editor.tooLargeDetail', { size: formatSize(file.size), limit: formatSize(EDIT_LIMIT) })"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <PreviewNotice v-else-if="status === 'loading'" tone="loading" :title="t('preview.text.reading')" />
    <PreviewNotice
      v-else-if="status === 'large'"
      tone="info"
      :title="t('preview.text.largeTitle')"
      :detail="t('preview.text.largeDetail', { size: formatSize(file.size) })"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton tone="primary" @click="load(true)">{{ t("preview.text.loadAnyway") }}</FluentButton>
    </PreviewNotice>
    <PreviewNotice
      v-else-if="status === 'error'"
      tone="error"
      :title="t('preview.text.errorTitle')"
      :detail="error"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton @click="load(true)">{{ t("common.retry") }}</FluentButton>
    </PreviewNotice>
    <template v-else>
      <PreviewToolbar>
        <FluentButton v-if="!readOnly" tone="primary" :disabled="!dirty || saving" @click="save">
          <FluentSvgIcon :svg="previewIcons.save" :size="18" />
          {{ saving ? t("preview.editor.saving") : t("preview.editor.save") }}
        </FluentButton>
        <FluentButton v-if="!readOnly" :disabled="!dirty || saving" @click="revert">
          <FluentSvgIcon :svg="previewIcons.arrowReset" :size="18" />
          {{ t("preview.editor.revert") }}
        </FluentButton>
        <span v-if="readOnly" class="hint">{{ readOnlyReason }}</span>
        <span v-else-if="dirty" class="hint">{{ t("preview.editor.unsaved") }}</span>
        <span class="spacer" />
        <span class="hint">{{ encoding }}</span>
        <FluentToggleButton v-model="wrap" tone="subtle">
          <FluentSvgIcon :svg="previewIcons.textWrap" :size="18" />
          {{ t("preview.text.wrap") }}
        </FluentToggleButton>
      </PreviewToolbar>
      <p v-if="saveError" class="editor__error" role="alert">{{ t("preview.editor.saveFailed", { reason: saveError }) }}</p>
      <div ref="host" class="editor__host" />
    </template>
  </div>
</template>

<style scoped>
.editor__host {
  height: clamp(280px, 70dvh, 820px);
}
.editor__error {
  margin: 0;
  padding: 8px 12px;
  color: var(--fluent-danger, #c42b1c);
  border-bottom: 1px solid var(--fluent-border);
}
</style>
