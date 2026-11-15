<script setup lang="ts">
import type { TaskCard as Card } from "./cards"
import TaskCard from "./TaskCard.vue"

defineProps<{ cards: Card[] }>()
defineEmits<{ navigate: [] }>()
</script>

<template>
  <TransitionGroup tag="ul" name="task" class="task-list">
    <TaskCard v-for="card in cards" :key="card.id" :card="card" @navigate="$emit('navigate')" />
  </TransitionGroup>
</template>

<style scoped>
.task-list {
  position: relative;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
}
.task-enter-active {
  transition:
    opacity var(--fluent-normal) var(--fluent-ease),
    transform var(--fluent-normal) var(--fluent-ease);
}
.task-leave-active {
  position: absolute;
  inset-inline: 0;
  transition:
    opacity var(--fluent-faster) var(--fluent-ease-accelerate),
    transform var(--fluent-faster) var(--fluent-ease-accelerate);
}
.task-move {
  transition: transform var(--fluent-fast) var(--fluent-ease);
}
.task-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.task-leave-to {
  opacity: 0;
  transform: translateX(16px);
}
</style>
