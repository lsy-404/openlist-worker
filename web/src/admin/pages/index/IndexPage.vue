<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentNotice, FluentProgressBar, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { ApiError, request } from "@/api"
import { adminGet } from "@/admin/api"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import AdminPage from "@/admin/components/AdminPage.vue"
import { askConfirm } from "@/stores/dialogs"
import { notify } from "@/stores/toast"
import { icons, systemIcons } from "@/utils/icons"

interface IndexProgress {
  obj_count: number
  is_done: boolean
  last_done_time: string | null
  error: string
}

// Builds walk every storage inside one request, so allow far longer than a normal call
const SLOW_MS = 600_000
const POLL_MS = 2000

const { t, locale } = useI18n()

const progress = ref<IndexProgress | null>(null)
const loadError = ref<string | null>(null)
const busy = ref<"build" | "update" | "stop" | "clear" | null>(null)
const paths = ref("/")
let timer: ReturnType<typeof setInterval> | null = null

const running = computed(() => busy.value === "build" || busy.value === "update" || progress.value?.is_done === false)
const lastDone = computed(() => (progress.value?.last_done_time ? new Date(progress.value.last_done_time).toLocaleString(locale.value) : t("adminIndex.never")))

async function refresh() {
  try {
    progress.value = await adminGet<IndexProgress>("/index/progress")
    loadError.value = null
  } catch (err) {
    loadError.value = err instanceof ApiError ? err.message : String(err)
  }
}

function startPolling() {
  if (!timer) timer = setInterval(() => void refresh(), POLL_MS)
}
function stopPolling() {
  if (timer) clearInterval(timer)
  timer = null
}

async function run(action: "build" | "update" | "stop" | "clear", body?: unknown, timeout?: number) {
  busy.value = action
  if (action === "build" || action === "update") startPolling()
  try {
    progress.value = await request<IndexProgress>("POST", `/api/admin/index/${action}`, body ?? {}, undefined, timeout)
    notify(t(`adminIndex.done.${action}`), "success")
  } catch (err) {
    notify(err instanceof ApiError ? err.message : String(err), "danger")
    await refresh()
  } finally {
    busy.value = null
    stopPolling()
    if (progress.value?.is_done === false) startPolling()
  }
}

function build() {
  void run("build", undefined, SLOW_MS)
}

function update() {
  const list = paths.value
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean)
  void run("update", { paths: list.length ? list : ["/"] }, SLOW_MS)
}

async function clearIndex() {
  const attempted = await askConfirm({
    title: t("adminIndex.clear.title"),
    message: t("adminIndex.clear.message"),
    confirmLabel: t("adminIndex.clear.confirm"),
    danger: true,
    async run() {
      await run("clear")
    },
  })
  if (attempted) await refresh()
}

async function stop() {
  const attempted = await askConfirm({
    title: t("adminIndex.stop.title"),
    message: t("adminIndex.stop.message"),
    confirmLabel: t("adminIndex.stop.confirm"),
    async run() {
      await run("stop")
    },
  })
  if (attempted) await refresh()
}

onMounted(async () => {
  await refresh()
  if (progress.value?.is_done === false) startPolling()
})
onBeforeUnmount(stopPolling)
</script>

<template>
  <AdminPage :description="t('adminIndex.description')">
    <template #actions>
      <FluentButton tone="primary" :disabled="!!busy" :busy="busy === 'build'" @click="build">
        <FluentSvgIcon :svg="systemIcons.search" :size="18" />
        {{ t("adminIndex.actions.build") }}
      </FluentButton>
      <FluentButton :disabled="!!busy" :busy="busy === 'update'" @click="update">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("adminIndex.actions.update") }}
      </FluentButton>
      <FluentButton :disabled="!running || busy === 'stop'" @click="stop">
        <FluentSvgIcon :svg="systemIcons.stop" :size="18" />
        {{ t("adminIndex.actions.stop") }}
      </FluentButton>
      <FluentButton tone="subtle" :disabled="!!busy" @click="clearIndex">
        <FluentSvgIcon :svg="icons.deleteIcon" :size="18" />
        {{ t("adminIndex.actions.clear") }}
      </FluentButton>
    </template>

    <FluentNotice v-if="loadError" tone="danger">{{ loadError }}</FluentNotice>
    <section v-if="progress" class="status" :aria-label="t('adminIndex.status')">
      <FluentProgressBar v-if="running" indeterminate :aria-label="t('adminIndex.running')" />
      <dl class="status__list">
        <div>
          <dt>{{ t("adminIndex.state") }}</dt>
          <dd>{{ running ? t("adminIndex.running") : progress.error ? t("adminIndex.failed") : t("adminIndex.idle") }}</dd>
        </div>
        <div>
          <dt>{{ t("adminIndex.objects") }}</dt>
          <dd>{{ progress.obj_count }}</dd>
        </div>
        <div>
          <dt>{{ t("adminIndex.lastDone") }}</dt>
          <dd>{{ lastDone }}</dd>
        </div>
      </dl>
      <FluentNotice v-if="progress.error" tone="danger">{{ progress.error }}</FluentNotice>
    </section>

    <section class="paths">
      <AdminFormField
        v-model="paths"
        kind="textarea"
        :rows="3"
        :label="t('adminIndex.paths')"
        :help="t('adminIndex.pathsHelp')"
        :disabled="!!busy"
      />
    </section>
  </AdminPage>
</template>

<style scoped>
.status {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.status__list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 12px;
  margin: 0;
}
.status__list dt {
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.status__list dd {
  margin: 2px 0 0;
  font-size: 1.25rem;
  font-weight: 600;
}
.paths {
  margin-top: 16px;
}
</style>
