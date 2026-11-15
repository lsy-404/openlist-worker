<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { ref, watch } from "vue"
import { FluentButton, FluentDialog, FluentPasswordField } from "@platform-kit/fluent/vue"

const { t } = useI18n()
const props = defineProps<{ open: boolean; path: string; wrong: boolean; busy: boolean }>()
const emit = defineEmits<{ submit: [password: string]; cancel: [] }>()

const value = ref("")
watch(
  () => props.open,
  (open) => {
    if (open) value.value = ""
  },
)

function submit() {
  if (value.value) emit("submit", value.value)
}
</script>

<template>
  <FluentDialog :open="open" :label="t('files.password.label')" @close="emit('cancel')">
    <template #title>
      <h2 class="title">{{ t("files.password.title") }}</h2>
    </template>
    <form class="form" @submit.prevent="submit">
      <p class="path">{{ path }}</p>
      <FluentPasswordField
        v-model="value"
        :label="t('files.password.field')"
        autocomplete="off"
        :invalid="wrong"
        autofocus
      />
      <p v-if="wrong" class="error" role="alert">{{ t("files.password.wrong") }}</p>
      <button type="submit" hidden />
    </form>
    <template #footer>
      <FluentButton tone="primary" :busy="busy" :disabled="!value" @click="submit">{{ t("common.confirm") }}</FluentButton>
      <FluentButton @click="emit('cancel')">{{ t("common.cancel") }}</FluentButton>
    </template>
  </FluentDialog>
</template>

<style scoped>
.title {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: min(360px, 78vw);
}
.path {
  margin: 0;
  color: var(--fluent-muted);
  overflow-wrap: anywhere;
}
.error {
  margin: 0;
  color: var(--fluent-danger);
}
</style>
