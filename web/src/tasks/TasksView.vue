<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSegmented } from "@platform-kit/fluent/vue"
import StateMessage from "@/components/StateMessage.vue"
import { taskIcons } from "./icons"
import { cards, isCardPending, type TaskCard } from "./cards"
import TaskList from "./TaskList.vue"
import { cancelAllTasks, clearFinishedTasks } from "./store"

type Filter = "all" | "running" | "finished" | "failed"

const { t } = useI18n()
const filter = ref<Filter>("all")

const MATCH: Record<Filter, (card: TaskCard) => boolean> = {
  all: () => true,
  running: isCardPending,
  finished: (card) => card.state === "succeeded" || card.state === "cancelled",
  failed: (card) => card.state === "failed",
}

const counts = computed(() => ({
  all: cards.value.length,
  running: cards.value.filter(MATCH.running).length,
  finished: cards.value.filter(MATCH.finished).length,
  failed: cards.value.filter(MATCH.failed).length,
}))
const options = computed(() =>
  (Object.keys(MATCH) as Filter[]).map((value) => ({ value, label: `${t(`tasks.filters.${value}`)} ${counts.value[value]}` })),
)
const visible = computed(() => cards.value.filter(MATCH[filter.value]))
const canCancel = computed(() => cards.value.some((card) => card.cancel))
const canClear = computed(() => counts.value.finished + counts.value.failed > 0)
</script>

<template>
  <section class="tasks">
    <header class="tasks__head">
      <h1 class="tasks__title">{{ t("tasks.title") }}</h1>
      <p class="tasks__desc">{{ t("tasks.description") }}</p>
    </header>

    <div class="tasks__bar">
      <FluentSegmented v-model="filter" :options="options" :label="t('tasks.filters.label')" />
      <div class="tasks__actions">
        <FluentButton v-if="canCancel" @click="cancelAllTasks">{{ t("tasks.actions.cancelAll") }}</FluentButton>
        <FluentButton :disabled="!canClear" @click="clearFinishedTasks">{{ t("tasks.actions.clearFinished") }}</FluentButton>
      </div>
    </div>

    <div v-if="visible.length" class="tasks__list"><TaskList :cards="visible" /></div>
    <StateMessage v-else :icon="taskIcons.taskList" :title="t(`tasks.empty.${filter}.title`)" :detail="t(`tasks.empty.${filter}.detail`)" />
  </section>
</template>

<style scoped>
.tasks {
  box-sizing: border-box;
  width: 100%;
  max-width: 1000px;
  padding: 24px 32px 32px;
}
.tasks__title {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 600;
  line-height: 1.3;
}
.tasks__desc {
  margin: 4px 0 0;
  color: var(--fluent-muted);
}
.tasks__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-top: 16px;
}
.tasks__actions {
  display: flex;
  gap: 8px;
}
.tasks__list {
  margin-top: 16px;
}
@media (max-width: 640px) {
  .tasks {
    padding: 16px;
  }
  .tasks__title {
    font-size: 1.4rem;
  }
}
</style>
