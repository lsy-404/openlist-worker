<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute } from "vue-router"
import { FluentButton, FluentPopover, FluentProgressRing, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { cards, hasFailed, isCardPending, overall } from "./cards"
import { taskIcons } from "./icons"
import { clearFinishedTasks, runningCount } from "./store"
import TaskList from "./TaskList.vue"

const { t } = useI18n()
const route = useRoute()

const open = ref(false)
const closing = ref(false)
const anchor = ref<HTMLElement | null>(null)
let fallback = 0

const visible = computed(() => cards.value.length > 0 || route.path === "/@tasks")
const canClear = computed(() => cards.value.some((card) => !isCardPending(card)))
const label = computed(() =>
  runningCount.value
    ? t("tasks.center.buttonRunning", { count: runningCount.value })
    : hasFailed.value
      ? t("tasks.center.buttonFailed")
      : t("tasks.center.title"),
)

function finish() {
  clearTimeout(fallback)
  open.value = false
  closing.value = false
}

// The popover is removed when `open` turns false, so the exit animation runs first
function requestClose() {
  if (!open.value || closing.value) return
  closing.value = true
  fallback = window.setTimeout(finish, 300)
}

function toggle() {
  if (open.value) requestClose()
  else open.value = true
}

function onAnimationEnd(event: AnimationEvent) {
  if (closing.value && event.target === event.currentTarget) finish()
}

onBeforeUnmount(() => clearTimeout(fallback))
</script>

<template>
  <span v-if="visible" ref="anchor" class="center">
    <FluentButton
      class="center__button"
      tone="subtle"
      icon-only
      :aria-label="label"
      :title="label"
      aria-haspopup="dialog"
      :aria-expanded="open"
      @click="toggle"
    >
      <FluentSvgIcon :svg="taskIcons.taskList" :size="20" />
      <FluentProgressRing v-if="runningCount" class="center__ring" active :size="30" :indeterminate="overall.indeterminate" :value="overall.percent" :max="100" />
      <span v-if="runningCount" class="center__badge" aria-hidden="true">{{ runningCount > 99 ? "99+" : runningCount }}</span>
      <span v-else-if="hasFailed" class="center__dot center__dot--error" aria-hidden="true" />
      <span v-else class="center__dot center__dot--ok" aria-hidden="true" />
    </FluentButton>

    <FluentPopover
      :open="open"
      :anchor="anchor"
      :label="t('tasks.center.title')"
      :class="['status-flyout', { 'status-flyout--closing': closing }]"
      @update:open="requestClose"
      @animationend="onAnimationEnd"
    >
      <header class="flyout__head">
        <h2 class="flyout__title">{{ t("tasks.center.title") }}</h2>
        <FluentButton :disabled="!canClear" @click="clearFinishedTasks">{{ t("tasks.center.clearCompleted") }}</FluentButton>
      </header>
      <div class="flyout__body">
        <TaskList v-if="cards.length" :cards="cards" @navigate="requestClose" />
        <p v-else class="flyout__empty">{{ t("tasks.center.empty") }}</p>
      </div>
      <footer v-if="route.path !== '/@tasks'" class="flyout__foot">
        <RouterLink to="/@tasks" class="flyout__all" @click="requestClose">{{ t("tasks.center.viewAll") }}</RouterLink>
      </footer>
    </FluentPopover>
  </span>
</template>

<style scoped>
.center {
  display: inline-flex;
}
.center__button {
  position: relative;
}
.center__ring {
  position: absolute;
  inset: 0;
  margin: auto;
  pointer-events: none;
  color: var(--fluent-accent-link);
}
.center__badge {
  position: absolute;
  top: -2px;
  inset-inline-end: -2px;
  min-width: 16px;
  padding: 0 4px;
  box-sizing: border-box;
  border-radius: 999px;
  background: var(--fluent-accent);
  color: var(--fluent-accent-text);
  font-size: 0.7rem;
  line-height: 16px;
  text-align: center;
}
.center__dot {
  position: absolute;
  top: 3px;
  inset-inline-end: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--fluent-mica);
}
.center__dot--ok {
  background: var(--fluent-success);
}
.center__dot--error {
  background: var(--fluent-danger);
}
.flyout__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px 8px 16px;
}
.flyout__title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}
.flyout__body {
  max-height: min(65dvh, 520px);
  overflow-y: auto;
  padding: 0 12px 12px;
}
.flyout__empty {
  margin: 0;
  padding: 32px 0 40px;
  text-align: center;
  color: var(--fluent-muted);
}
.flyout__foot {
  padding: 8px 16px 10px;
  border-top: 1px solid var(--fluent-border);
}
.flyout__all {
  font-size: 0.9rem;
}
</style>

<style>
.status-flyout.fluent-popover {
  width: 400px;
  max-width: calc(100vw - 16px);
  padding: 0;
}
.status-flyout.fluent-popover[data-fluent-menu-motion] {
  transform-origin: top;
  animation: status-flyout-in var(--fluent-fast) var(--fluent-ease);
}
.status-flyout.status-flyout--closing.fluent-popover[data-fluent-menu-motion] {
  animation: status-flyout-out var(--fluent-faster) var(--fluent-ease-accelerate) forwards;
}
@keyframes status-flyout-in {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@keyframes status-flyout-out {
  to {
    opacity: 0;
    transform: translateY(-8px);
  }
}
@media (max-width: 640px) {
  .status-flyout.fluent-popover {
    left: 0 !important;
    right: 0 !important;
    top: auto !important;
    bottom: 0 !important;
    width: auto;
    max-width: none !important;
    border-radius: var(--fluent-panel-radius) var(--fluent-panel-radius) 0 0;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .status-flyout.fluent-popover .flyout__body {
    max-height: calc(80dvh - 120px);
  }
  .status-flyout.fluent-popover[data-fluent-menu-motion] {
    animation: status-sheet-in var(--fluent-normal) var(--fluent-ease);
  }
  .status-flyout.status-flyout--closing.fluent-popover[data-fluent-menu-motion] {
    animation: status-sheet-out var(--fluent-fast) var(--fluent-ease-accelerate) forwards;
  }
}
@keyframes status-sheet-in {
  from {
    transform: translateY(100%);
  }
}
@keyframes status-sheet-out {
  to {
    transform: translateY(100%);
  }
}
</style>
