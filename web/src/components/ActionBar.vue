<script setup lang="ts">
import { computed } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { actionLabel, actionsFor, type ActionContext } from "@/actions"

const props = defineProps<{ ctx: ActionContext }>()
const list = computed(() => actionsFor(props.ctx))
</script>

<template>
  <div v-if="list.length" class="actions">
    <FluentButton
      v-for="action in list"
      :key="action.id"
      :tone="action.primary ? 'primary' : 'secondary'"
      @click="action.run(ctx)"
    >
      <FluentSvgIcon :svg="action.icon" :size="18" />
      {{ actionLabel(action, ctx) }}
    </FluentButton>
  </div>
</template>

<style scoped>
.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
