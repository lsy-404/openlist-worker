<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { FluentButton, FluentProgressBar, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { formatSize } from "@/utils/format"
import { icons } from "@/utils/icons"
import { encodePath } from "@/utils/path"
import { taskIcons } from "./icons"
import { dismissTask, type Task, type TaskKind } from "./store"

const props = defineProps<{ task: Task; now: number }>()

const { t, locale } = useI18n()
const router = useRouter()

const KIND_ICON: Record<TaskKind, string> = {
  upload: icons.arrowUpload,
  copy: icons.copy,
  move: icons.arrowMove,
  delete: icons.deleteIcon,
  rename: icons.rename,
  mkdir: icons.folderAdd,
}

const pending = computed(() => props.task.state === "queued" || props.task.state === "running")
const stateKey = computed(() => (props.task.interrupted ? "interrupted" : props.task.state))
const paths = computed(() => [props.task.source, props.task.target].filter(Boolean).join("  →  "))

const clock = computed(() => new Intl.DateTimeFormat(locale.value, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))

function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const parts: [number, string][] = hours ? [[hours, "hour"], [minutes, "minute"]] : minutes ? [[minutes, "minute"], [seconds, "second"]] : [[seconds, "second"]]
  return parts.map(([value, unit]) => new Intl.NumberFormat(locale.value, { style: "unit", unit, unitDisplay: "narrow" }).format(value)).join(" ")
}

const meta = computed(() => {
  const task = props.task
  const list: string[] = []
  if (task.size > 0) list.push(task.state === "running" ? `${formatSize(task.loaded)} / ${formatSize(task.size)}` : formatSize(task.size))
  if (task.startedAt) list.push(t("tasks.detail.started", { time: clock.value.format(task.startedAt) }))
  if (task.state === "running" && task.startedAt) list.push(t("tasks.detail.elapsed", { duration: duration(props.now - task.startedAt) }))
  else if (task.endedAt && task.startedAt && !task.interrupted) list.push(t("tasks.detail.took", { duration: duration(task.endedAt - task.startedAt) }))
  return list.join(" · ")
})

const note = computed(() => (props.task.interrupted ? t("tasks.interruptedHint") : props.task.state === "failed" ? props.task.error : ""))

function open() {
  void router.push(encodePath(props.task.folder))
}
</script>

<template>
  <li class="task" :data-state="task.state">
    <span class="task__icon"><FluentSvgIcon :svg="KIND_ICON[task.kind]" :size="20" /></span>
    <div class="task__main">
      <div class="task__head">
        <span class="task__title" :title="task.title">{{ task.title }}</span>
        <span class="task__kind">{{ t(`tasks.kind.${task.kind}`) }}</span>
        <span class="badge" :data-tone="task.interrupted ? 'failed' : task.state">{{ t(`tasks.state.${stateKey}`) }}</span>
      </div>
      <span v-if="paths" class="task__paths" :title="paths">{{ paths }}</span>
      <FluentProgressBar
        v-if="task.state === 'running'"
        class="task__bar"
        :indeterminate="task.size <= 0"
        :value="task.loaded"
        :max="task.size || 1"
        :label="t('tasks.progress', { name: task.title })"
      />
      <span v-if="meta" class="task__meta">{{ meta }}</span>
      <span v-if="note" class="task__note" :data-tone="task.interrupted ? 'muted' : 'danger'">{{ note }}</span>
    </div>
    <div class="task__actions">
      <FluentButton
        v-if="task.cancel"
        tone="subtle"
        icon-only
        :aria-label="t('tasks.actions.cancelItem', { name: task.title })"
        :title="t('tasks.actions.cancel')"
        @click="task.cancel?.()"
      >
        <FluentSvgIcon :svg="icons.dismiss" :size="18" />
      </FluentButton>
      <FluentButton
        v-if="task.retry"
        tone="subtle"
        icon-only
        :aria-label="t('tasks.actions.retryItem', { name: task.title })"
        :title="t('tasks.actions.retry')"
        @click="task.retry?.()"
      >
        <FluentSvgIcon :svg="icons.arrowCounterclockwise" :size="18" />
      </FluentButton>
      <FluentButton
        v-if="task.state !== 'queued'"
        tone="subtle"
        icon-only
        :aria-label="t('tasks.actions.openItem', { name: task.title })"
        :title="t('tasks.actions.open')"
        @click="open"
      >
        <FluentSvgIcon :svg="taskIcons.openFolder" :size="18" />
      </FluentButton>
      <FluentButton
        v-if="!pending"
        tone="subtle"
        icon-only
        :aria-label="t('tasks.actions.dismissItem', { name: task.title })"
        :title="t('tasks.actions.dismiss')"
        @click="dismissTask(task.id)"
      >
        <FluentSvgIcon :svg="icons.deleteIcon" :size="18" />
      </FluentButton>
    </div>
  </li>
</template>

<style scoped>
.task {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
}
.task__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  background: var(--fluent-control);
  border-radius: var(--fluent-radius);
}
.task__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.task__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
  min-width: 0;
}
.task__title {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}
.task__kind {
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.task__paths,
.task__meta {
  color: var(--fluent-muted);
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.task__note {
  font-size: 0.85rem;
  overflow-wrap: anywhere;
}
.task__note[data-tone="danger"] {
  color: var(--fluent-danger);
}
.task__note[data-tone="muted"] {
  color: var(--fluent-muted);
}
.task__actions {
  flex: none;
  display: flex;
  gap: 2px;
  margin-block: -2px;
}
.badge {
  padding: 0 8px;
  border-radius: 999px;
  border: 1px solid var(--fluent-border);
  font-size: 0.75rem;
  line-height: 20px;
  white-space: nowrap;
  color: var(--fluent-text);
  background: var(--fluent-control);
}
.badge[data-tone="running"] {
  background: color-mix(in srgb, var(--fluent-accent) 18%, transparent);
  border-color: color-mix(in srgb, var(--fluent-accent) 45%, transparent);
}
.badge[data-tone="succeeded"] {
  background: color-mix(in srgb, var(--fluent-success) 18%, transparent);
  border-color: color-mix(in srgb, var(--fluent-success) 45%, transparent);
}
.badge[data-tone="failed"] {
  background: color-mix(in srgb, var(--fluent-danger) 18%, transparent);
  border-color: color-mix(in srgb, var(--fluent-danger) 45%, transparent);
}
@media (max-width: 640px) {
  .task {
    gap: 8px;
    padding: 10px;
  }
  .task__icon {
    width: 32px;
    height: 32px;
  }
}
</style>
