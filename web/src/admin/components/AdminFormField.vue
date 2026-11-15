<script setup lang="ts">
import { computed, useId } from "vue"
import {
  FluentField,
  FluentNumberField,
  FluentPasswordField,
  FluentSelect,
  FluentSwitch,
  FluentTextArea,
  type FluentSelectOption,
} from "@platform-kit/fluent/vue"

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    kind?: "text" | "number" | "select" | "switch" | "textarea" | "password"
    label: string
    help?: string
    error?: string
    options?: readonly FluentSelectOption[]
  }>(),
  { kind: "text", help: undefined, error: undefined, options: () => [] },
)
const model = defineModel<string | number | boolean | null>()

const id = useId()
const describedBy = computed(() => (props.error ? `${id}-error` : props.help ? `${id}-help` : undefined))

const text = computed({
  get: () => (model.value == null ? "" : String(model.value)),
  set: (value: string) => (model.value = value),
})
const num = computed({
  get: () => (typeof model.value === "number" ? model.value : null),
  set: (value: number | null) => (model.value = value),
})
const flag = computed({
  get: () => model.value === true,
  set: (value: boolean) => (model.value = value),
})
</script>

<template>
  <div class="form-field">
    <FluentSwitch v-if="kind === 'switch'" v-model="flag" :label="label" :aria-describedby="describedBy" v-bind="$attrs" />
    <label v-else-if="kind === 'select'" class="form-field__select">
      <span class="form-field__label">{{ label }}</span>
      <FluentSelect v-model="text" :label="label" :options="options" :aria-describedby="describedBy" v-bind="$attrs" />
    </label>
    <FluentNumberField v-else-if="kind === 'number'" v-model="num" :label="label" :invalid="!!error" :aria-describedby="describedBy" v-bind="$attrs" />
    <FluentPasswordField v-else-if="kind === 'password'" v-model="text" :label="label" :invalid="!!error" :aria-describedby="describedBy" v-bind="$attrs" />
    <FluentTextArea v-else-if="kind === 'textarea'" v-model="text" :label="label" :invalid="!!error" :aria-describedby="describedBy" v-bind="$attrs" />
    <FluentField v-else v-model="text" :label="label" :invalid="!!error" :aria-describedby="describedBy" v-bind="$attrs" />
    <p v-if="error" :id="`${id}-error`" class="form-field__error" role="alert">{{ error }}</p>
    <p v-else-if="help" :id="`${id}-help`" class="form-field__help">{{ help }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-field__select {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.form-field__label {
  font-size: 0.85rem;
}
.form-field__help,
.form-field__error {
  margin: 0;
  font-size: 0.8rem;
}
.form-field__help {
  color: var(--fluent-muted);
}
.form-field__error {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
</style>
