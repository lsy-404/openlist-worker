<script setup lang="ts">
import { ref, watch } from "vue"
import { FluentButton, FluentDialog, FluentPasswordField } from "@platform-kit/fluent/vue"

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
  <FluentDialog :open="open" label="需要密码" @close="emit('cancel')">
    <template #title>
      <h2 class="title">此文件夹需要密码</h2>
    </template>
    <form class="form" @submit.prevent="submit">
      <p class="path">{{ path }}</p>
      <FluentPasswordField
        v-model="value"
        label="访问密码"
        autocomplete="off"
        :invalid="wrong"
        autofocus
      />
      <p v-if="wrong" class="error" role="alert">密码不正确，请重试。</p>
      <button type="submit" hidden />
    </form>
    <template #footer>
      <FluentButton tone="primary" :busy="busy" :disabled="!value" @click="submit">确定</FluentButton>
      <FluentButton @click="emit('cancel')">取消</FluentButton>
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
