<script setup lang="ts">
import { computed } from "vue"
import { FluentSelect } from "@platform-kit/fluent/vue"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import { isSecret, type DriverField, type FieldValue } from "./types"

const props = defineProps<{ field: DriverField; label: string; help?: string; error?: string }>()
const model = defineModel<FieldValue>({ required: true })

const kind = computed(() => {
  const { type } = props.field
  if (type === "bool") return "switch"
  if (type === "number" || type === "float") return "number"
  if (isSecret(props.field)) return "password"
  return type === "text" ? "textarea" : "text"
})
const options = computed(() =>
  (props.field.options ?? "")
    .split(",")
    .filter(Boolean)
    .map((value) => ({ value, label: value })),
)
</script>

<template>
  <!-- AdminFormField prints a select's label twice, so selects use FluentSelect directly -->
  <div v-if="field.type === 'select'" class="select">
    <FluentSelect v-model="model as string" :label="label" :options="options" />
    <p v-if="error" class="select__note select__note--error" role="alert">{{ error }}</p>
    <p v-else-if="help" class="select__note">{{ help }}</p>
  </div>
  <AdminFormField v-else v-model="model" :kind="kind" :label="label" :help="help" :error="error" :rows="kind === 'textarea' ? 3 : undefined" />
</template>

<style scoped>
.select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.select__note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--fluent-muted);
}
.select__note--error {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
</style>
