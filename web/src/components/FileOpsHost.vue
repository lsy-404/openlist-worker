<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, nextTick, ref, watch } from "vue"
import { FluentButton, FluentDialog, FluentField, FluentNotice, FluentProgressBar, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { api } from "@/api"
import { activeDialog, closeDialog, type DialogRequest } from "@/stores/dialogs"
import { passwordFor } from "@/stores/passwords"
import { icons } from "@/utils/icons"
import { joinPath, parentPath, splitPath } from "@/utils/path"

type Operation = Extract<DialogRequest, { run: unknown }>

const { t, locale } = useI18n()
// The last request stays rendered while the dialog fades out
let last: DialogRequest | null = null
const dialog = computed(() => (last = activeDialog.value ?? last))
const operation = computed(() => (dialog.value && dialog.value.kind !== "conflict" ? (dialog.value as Operation) : null))
const heading = computed(() => (dialog.value?.kind === "conflict" ? t("files.conflict.title") : (operation.value?.title ?? "")))

const busy = ref(false)
const error = ref("")
const attempted = ref(false)
const text = ref("")
const folder = ref("/")
const dirs = ref<string[]>([])
const dirsLoading = ref(false)
const dirsError = ref("")
const form = ref<HTMLElement | null>(null)

const collator = computed(() => new Intl.Collator(locale.value, { numeric: true, sensitivity: "base" }))
let loadId = 0
async function loadDirs(path: string) {
  const id = ++loadId
  dirsLoading.value = true
  dirsError.value = ""
  try {
    const list = await api.fsDirs(path, passwordFor(path))
    if (id !== loadId) return
    dirs.value = (list ?? []).map((d) => d.name).sort(collator.value.compare)
  } catch (err) {
    if (id !== loadId) return
    dirs.value = []
    dirsError.value = err instanceof Error ? err.message : String(err)
  } finally {
    if (id === loadId) dirsLoading.value = false
  }
}

watch(dialog, async (request) => {
  busy.value = false
  error.value = ""
  attempted.value = false
  if (request?.kind === "prompt") {
    text.value = request.value
    await nextTick()
    // The dialog is modal-shown after this tick, which would take focus back
    setTimeout(() => {
      const input = form.value?.querySelector("input")
      if (!input) return
      input.focus()
      const dot = request.selectStem ? request.value.lastIndexOf(".") : -1
      input.setSelectionRange(0, dot > 0 ? dot : request.value.length)
    }, 50)
  } else if (request?.kind === "folder") {
    folder.value = request.start
    void loadDirs(request.start)
  }
})

function enter(path: string) {
  folder.value = path
  void loadDirs(path)
}

const crumbs = computed(() => {
  const parts = splitPath(folder.value)
  return [{ name: t("files.picker.root"), path: "/" }, ...parts.map((name, i) => ({ name, path: "/" + parts.slice(0, i + 1).join("/") }))]
})

const blocked = computed(() => (dialog.value?.kind === "folder" ? dialog.value.blocked(folder.value) : null))
const canSubmit = computed(() => {
  if (busy.value) return false
  if (dialog.value?.kind === "prompt") return !!text.value.trim()
  if (dialog.value?.kind === "folder") return !blocked.value && !dirsLoading.value
  return true
})

async function submit() {
  const request = operation.value
  if (!request || !canSubmit.value) return
  busy.value = true
  error.value = ""
  attempted.value = true
  try {
    await request.run(request.kind === "prompt" ? text.value.trim() : request.kind === "folder" ? folder.value : "")
    request.settle(true)
    closeDialog()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

function cancel() {
  const request = dialog.value
  if (!request || busy.value) return
  if (request.kind === "conflict") request.settle(null)
  else request.settle(attempted.value)
  closeDialog()
}

function resolveConflict(overwrite: boolean) {
  const request = dialog.value
  if (request?.kind !== "conflict") return
  request.settle(overwrite)
  closeDialog()
}

const shownConflicts = computed(() => (dialog.value?.kind === "conflict" ? dialog.value.names.slice(0, 8) : []))
</script>

<template>
  <FluentDialog :open="!!activeDialog" :label="heading || t('files.dialogs.fallbackLabel')" @close="cancel">
    <template #title>
      <h2 class="title">{{ heading }}</h2>
    </template>

    <form v-if="dialog?.kind === 'prompt'" ref="form" class="body" @submit.prevent="submit">
      <FluentField v-model="text" :label="dialog.label" autocomplete="off" spellcheck="false" :invalid="!!error" />
      <FluentNotice v-if="error" tone="danger" role="alert">{{ error }}</FluentNotice>
      <button type="submit" hidden />
    </form>

    <div v-else-if="dialog?.kind === 'confirm'" class="body">
      <p class="text">{{ dialog.message }}</p>
      <ul v-if="dialog.detail.length" class="names">
        <li v-for="name in dialog.detail" :key="name">{{ name }}</li>
      </ul>
      <FluentNotice v-if="error" tone="danger" role="alert">{{ error }}</FluentNotice>
    </div>

    <div v-else-if="dialog?.kind === 'folder'" class="body">
      <nav class="crumbs" :aria-label="t('files.picker.label')">
        <template v-for="(crumb, i) in crumbs" :key="crumb.path">
          <FluentSvgIcon v-if="i" :svg="icons.chevronRight" :size="12" />
          <button
            type="button"
            class="crumbs__item"
            :aria-current="i === crumbs.length - 1 ? 'location' : undefined"
            @click="enter(crumb.path)"
          >
            {{ crumb.name }}
          </button>
        </template>
      </nav>
      <div class="dirs" :aria-busy="dirsLoading">
        <FluentProgressBar v-if="dirsLoading" indeterminate :label="t('common.loading')" class="dirs__bar" />
        <ul class="dirs__list">
          <li v-if="folder !== '/'">
            <button type="button" class="dirs__item" @click="enter(parentPath(folder))">
              <FluentSvgIcon :svg="icons.folderArrowUp" :size="20" />
              <span>{{ t("files.picker.parent") }}</span>
            </button>
          </li>
          <li v-for="name in dirs" :key="name">
            <button type="button" class="dirs__item" @click="enter(joinPath(folder, name))">
              <FluentSvgIcon :svg="icons.folder" :size="20" />
              <span>{{ name }}</span>
            </button>
          </li>
        </ul>
        <p v-if="!dirsLoading && !dirs.length && !dirsError" class="hint">{{ t("files.picker.empty") }}</p>
        <FluentNotice v-if="dirsError" tone="danger" role="alert">{{ dirsError }}</FluentNotice>
      </div>
      <p class="hint" aria-live="polite">{{ blocked ?? t("files.picker.target", { folder }) }}</p>
      <FluentNotice v-if="error" tone="danger" role="alert">{{ error }}</FluentNotice>
    </div>

    <div v-else-if="dialog?.kind === 'conflict'" class="body">
      <p class="text">{{ t("files.conflict.message", { count: dialog.names.length }) }}</p>
      <ul class="names">
        <li v-for="name in shownConflicts" :key="name">{{ name }}</li>
        <li v-if="dialog.names.length > shownConflicts.length">{{ t("files.conflict.more", { count: dialog.names.length }) }}</li>
      </ul>
    </div>

    <template #footer>
      <template v-if="dialog?.kind === 'conflict'">
        <FluentButton tone="primary" @click="resolveConflict(true)">{{ t("files.conflict.overwrite") }}</FluentButton>
        <FluentButton @click="resolveConflict(false)">{{ t("files.conflict.skip") }}</FluentButton>
        <FluentButton @click="cancel">{{ t("files.conflict.cancel") }}</FluentButton>
      </template>
      <template v-else-if="operation">
        <FluentButton
          :tone="operation.kind === 'confirm' && operation.danger ? 'danger' : 'primary'"
          :busy="busy"
          :disabled="!canSubmit"
          @click="submit"
        >
          {{ operation.confirmLabel }}
        </FluentButton>
        <FluentButton :disabled="busy" @click="cancel">{{ t("common.cancel") }}</FluentButton>
      </template>
    </template>
  </FluentDialog>
</template>

<style scoped>
.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(380px, 78vw);
  max-width: 100%;
}
.text,
.hint {
  margin: 0;
  overflow-wrap: anywhere;
}
.hint {
  color: var(--fluent-muted);
  font-size: 0.9rem;
}
.names {
  margin: 0;
  padding-inline-start: 20px;
  max-height: 30vh;
  overflow: auto;
  color: var(--fluent-muted);
  overflow-wrap: anywhere;
}
.crumbs {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px;
}
.crumbs__item {
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  padding: 4px 6px;
  border-radius: var(--fluent-radius);
  cursor: pointer;
  transition: var(--motion-fill);
}
.crumbs__item:hover {
  background: var(--fluent-control-hover);
}
.crumbs__item[aria-current] {
  font-weight: 600;
}
.crumbs__item:focus-visible,
.dirs__item:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.dirs {
  position: relative;
  min-height: 160px;
  max-height: 40vh;
  overflow: auto;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
  padding: 4px;
}
.dirs__bar {
  position: absolute;
  inset: 0 0 auto 0;
}
.dirs__list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.dirs__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 40px;
  padding: 0 8px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  border-radius: var(--fluent-radius);
  transition: var(--motion-fill);
}
.dirs__item:hover {
  background: var(--fluent-control-hover);
}
.dirs__item span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
