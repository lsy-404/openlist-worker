<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { FluentButton, FluentProgressBar, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { formatSize } from "@/utils/format"
import { browseIcons, icons } from "@/utils/icons"
import { encodePath } from "@/utils/path"
import { clock, dismissCard, formatDuration, isCardPending, metrics, type TaskCard } from "./cards"
import { taskIcons } from "./icons"
import TaskGlyph from "./TaskGlyph.vue"
import type { Task, TaskKind } from "./store"

const props = defineProps<{ card: TaskCard }>()
const emit = defineEmits<{ navigate: [] }>()

const { t, locale } = useI18n()
const router = useRouter()
const expanded = ref(false)

const KIND_ICON: Record<TaskKind, string> = {
  upload: icons.arrowUpload,
  copy: icons.copy,
  move: icons.arrowMove,
  delete: icons.deleteIcon,
  rename: icons.rename,
  mkdir: icons.folderAdd,
}

const pending = computed(() => isCardPending(props.card))
const phase = computed(() => (props.card.state === "queued" ? "queued" : pending.value ? "running" : props.card.state === "succeeded" ? "done" : props.card.state))
const title = computed(() => t(`tasks.card.${props.card.kind}.${phase.value}`, { what: props.card.what, dest: props.card.dest }))
const glyph = computed(() => (props.card.state === "succeeded" ? icons.checkmark : props.card.state === "failed" ? taskIcons.errorCircle : KIND_ICON[props.card.kind]))
const stateKey = computed(() => (props.card.interrupted ? "interrupted" : props.card.state))
const percent = computed(() => Math.round(props.card.fraction * 100))
const metric = computed(() => metrics[props.card.id])
const speed = computed(() => (metric.value && metric.value.speed > 0 ? `${formatSize(metric.value.speed)}/s` : ""))
const remaining = computed(() => {
  const { card } = props
  if (!metric.value || metric.value.speed <= 0 || card.size <= 0) return ""
  return formatDuration(((card.size - card.loaded) / metric.value.speed) * 1000)
})
const clockFormat = computed(() => new Intl.DateTimeFormat(locale.value, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }))
const elapsed = computed(() => {
  const { card } = props
  if (!card.startedAt) return ""
  if (pending.value) return formatDuration(clock.value - card.startedAt)
  return card.endedAt && !card.interrupted ? formatDuration(card.endedAt - card.startedAt) : ""
})

const summary = computed(() => {
  const { card } = props
  const total = card.tasks.length
  if (card.interrupted) return t("tasks.interruptedHint")
  if (card.state === "queued") return t("tasks.state.queued")
  if (pending.value) {
    const parts: string[] = []
    if (total > 1) parts.push(t("tasks.card.itemsDone", { done: card.done, total }))
    if (card.size > 0) parts.push(`${formatSize(card.loaded)} / ${formatSize(card.size)}`)
    if (speed.value) parts.push(speed.value)
    if (remaining.value) parts.push(t("tasks.card.left", { duration: remaining.value }))
    return parts.length ? parts.join(" · ") : t("tasks.card.working")
  }
  if (card.state === "failed") return total > 1 ? t("tasks.card.failedCount", { failed: card.failed, total }) : card.error || t("tasks.state.failed")
  if (card.state === "cancelled") return t("tasks.state.cancelled")
  return [card.size > 0 ? formatSize(card.size) : "", elapsed.value ? t("tasks.detail.took", { duration: elapsed.value }) : ""].filter(Boolean).join(" · ")
})

const details = computed(() => {
  const { card } = props
  const rows: [string, string][] = []
  if (card.route) rows.push([t("tasks.card.route"), card.route])
  if (card.startedAt) rows.push([t("tasks.card.started"), clockFormat.value.format(card.startedAt)])
  if (elapsed.value) rows.push([pending.value ? t("tasks.card.elapsed") : t("tasks.card.duration"), elapsed.value])
  if (card.size > 0) rows.push([t("tasks.card.size"), formatSize(card.size)])
  if (pending.value && speed.value) rows.push([t("tasks.card.speed"), speed.value])
  if (remaining.value) rows.push([t("tasks.card.remaining"), remaining.value])
  if (card.state === "failed" && card.tasks.length > 1 && card.error) rows.push([t("tasks.card.error"), card.error])
  return rows
})

const spark = computed(() => {
  const history = metric.value?.history ?? []
  if (history.length < 2) return ""
  const max = Math.max(...history, 1)
  return history.map((value, i) => `${((i / (history.length - 1)) * 100).toFixed(1)},${(30 - (value / max) * 28).toFixed(1)}`).join(" ")
})

function itemState(task: Task): string {
  if (task.state === "running" && task.size > 0) return `${Math.round((task.loaded / task.size) * 100)}%`
  if (task.state === "failed" && task.error) return task.error
  return t(`tasks.state.${task.state}`)
}

function open() {
  void router.push(encodePath(props.card.folder))
  emit("navigate")
}
</script>

<template>
  <li class="card" :data-state="card.state" :data-expanded="expanded">
    <div class="card__row">
      <span class="card__icon"><TaskGlyph :svg="glyph" :size="16" /></span>
      <div class="card__text">
        <span class="card__title" :title="title">{{ title }}</span>
        <span v-if="card.route" class="card__route" :title="card.route">{{ card.route }}</span>
      </div>
      <div class="card__actions">
        <FluentButton
          v-if="card.cancel"
          tone="subtle"
          icon-only
          :aria-label="t('tasks.actions.cancelItem', { name: card.what })"
          :title="t('tasks.actions.cancel')"
          @click="card.cancel?.()"
        >
          <FluentSvgIcon :svg="icons.dismiss" :size="18" />
        </FluentButton>
        <FluentButton
          v-if="card.retry"
          tone="subtle"
          icon-only
          :aria-label="t('tasks.actions.retryItem', { name: card.what })"
          :title="t('tasks.actions.retry')"
          @click="card.retry?.()"
        >
          <FluentSvgIcon :svg="icons.arrowCounterclockwise" :size="18" />
        </FluentButton>
        <FluentButton
          v-if="card.state !== 'queued'"
          tone="subtle"
          icon-only
          :aria-label="t('tasks.actions.openItem', { name: card.what })"
          :title="t('tasks.actions.open')"
          @click="open"
        >
          <FluentSvgIcon :svg="taskIcons.openFolder" :size="18" />
        </FluentButton>
        <FluentButton
          v-if="!pending"
          tone="subtle"
          icon-only
          :aria-label="t('tasks.actions.dismissItem', { name: card.what })"
          :title="t('tasks.actions.dismiss')"
          @click="dismissCard(card)"
        >
          <FluentSvgIcon :svg="icons.dismiss" :size="18" />
        </FluentButton>
        <FluentButton
          tone="subtle"
          icon-only
          class="card__chevron"
          :aria-expanded="expanded"
          :aria-label="expanded ? t('tasks.card.collapse') : t('tasks.card.expand')"
          :title="expanded ? t('tasks.card.collapse') : t('tasks.card.expand')"
          @click="expanded = !expanded"
        >
          <FluentSvgIcon :svg="browseIcons.chevronDown" :size="16" />
        </FluentButton>
      </div>
    </div>

    <div v-if="card.state === 'running'" class="card__progress">
      <FluentProgressBar :indeterminate="card.fraction < 0" :value="percent" :max="100" :label="t('tasks.progress', { name: card.what })" />
      <span v-if="card.fraction >= 0" class="card__percent">{{ percent }}%</span>
    </div>
    <span class="card__summary" :data-tone="card.state === 'failed' && !card.interrupted ? 'danger' : 'muted'">{{ summary }}</span>

    <div class="card__details" :inert="!expanded ? true : undefined">
      <div class="card__details-inner">
        <svg v-if="spark && card.state === 'running'" class="card__spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
          <polygon :points="`0,30 ${spark} 100,30`" class="card__spark-area" />
          <polyline :points="spark" class="card__spark-line" vector-effect="non-scaling-stroke" />
        </svg>
        <dl class="card__list">
          <template v-for="[label, value] in details" :key="label">
            <dt>{{ label }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
        <ul v-if="card.tasks.length > 1" class="card__items">
          <li v-for="task in card.tasks" :key="task.id" class="card__item" :data-state="task.state">
            <span class="card__item-name" :title="task.title">{{ task.title }}</span>
            <span class="card__item-state" :title="itemState(task)">{{ itemState(task) }}</span>
          </li>
        </ul>
      </div>
    </div>
    <span class="card__state-label">{{ t(`tasks.state.${stateKey}`) }}</span>
  </li>
</template>

<style scoped>
.card {
  --card-tone: var(--fluent-muted);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px 10px 12px;
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-panel-radius);
}
.card[data-state="queued"],
.card[data-state="running"] {
  --card-tone: var(--fluent-accent-link);
}
.card[data-state="succeeded"] {
  --card-tone: var(--fluent-success);
}
.card[data-state="failed"] {
  --card-tone: var(--fluent-danger);
}
.card__row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card__icon {
  flex: none;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  color: var(--card-tone);
  background: color-mix(in srgb, var(--card-tone) 14%, transparent);
}
.card__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.card__title {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  overflow-wrap: anywhere;
}
.card__route,
.card__summary {
  color: var(--fluent-muted);
  font-size: 0.8rem;
}
.card__route {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__summary {
  margin-inline-end: 4px;
  overflow-wrap: anywhere;
}
.card__summary[data-tone="danger"] {
  color: var(--fluent-danger);
}
.card__actions {
  flex: none;
  display: flex;
  margin-block: -4px;
}
.card__progress {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-inline-end: 4px;
}
.card__progress > :first-child {
  flex: 1;
  min-width: 0;
}
.card__percent {
  min-width: 3ch;
  text-align: end;
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}
.card__state-label {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.card__chevron :deep(img) {
  transition: transform var(--fluent-fast) var(--fluent-ease);
}
.card[data-expanded="true"] .card__chevron :deep(img) {
  transform: rotate(180deg);
}
.card__details {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows var(--fluent-fast) var(--fluent-ease-accelerate),
    opacity var(--fluent-faster) var(--fluent-ease-accelerate);
}
.card[data-expanded="true"] .card__details {
  grid-template-rows: 1fr;
  opacity: 1;
  transition:
    grid-template-rows var(--fluent-normal) var(--fluent-ease),
    opacity var(--fluent-normal) var(--fluent-ease);
}
.card__details-inner {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card[data-expanded="true"] .card__details-inner {
  padding-top: 4px;
}
.card__spark {
  width: 100%;
  height: 56px;
  flex: none;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
  box-sizing: border-box;
}
.card__spark-area {
  fill: color-mix(in srgb, var(--fluent-accent-link) 20%, transparent);
}
.card__spark-line {
  fill: none;
  stroke: var(--fluent-accent-link);
  stroke-width: 1.5;
}
.card__list {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 12px;
  margin: 0;
  font-size: 0.8rem;
}
.card__list dt {
  color: var(--fluent-muted);
}
.card__list dd {
  margin: 0;
  overflow-wrap: anywhere;
}
.card__items {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 140px;
  overflow-y: auto;
  font-size: 0.8rem;
}
.card__item {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  padding: 2px 0;
}
.card__item-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card__item-state {
  flex: none;
  max-width: 55%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--fluent-muted);
}
.card__item[data-state="failed"] .card__item-state {
  color: var(--fluent-danger);
}
.card__item[data-state="succeeded"] .card__item-state {
  color: var(--fluent-success);
}
</style>
