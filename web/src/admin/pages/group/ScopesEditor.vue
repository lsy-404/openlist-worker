<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import { icons } from "@/utils/icons"
import PermissionBits from "../user/PermissionBits.vue"
import { bitsOfPreset, emptyScope, presetOf, type ScopeForm } from "./types"

const { t } = useI18n()
const scopes = defineModel<ScopeForm[]>({ required: true })

const expanded = ref(new Set<ScopeForm>())
const options = computed(() => [
  { value: "read", label: t("adminGroup.presets.read") },
  { value: "write", label: t("adminGroup.presets.write") },
  { value: "custom", label: t("adminGroup.presets.custom") },
])

function toggle(scope: ScopeForm) {
  if (!expanded.value.delete(scope)) expanded.value.add(scope)
  expanded.value = new Set(expanded.value)
}

function setPreset(scope: ScopeForm, value: unknown) {
  if (value === "read" || value === "write") scope.bits = bitsOfPreset(value)
  else if (!expanded.value.has(scope)) toggle(scope)
}

function remove(index: number) {
  expanded.value.delete(scopes.value[index])
  scopes.value.splice(index, 1)
}
</script>

<template>
  <div class="scopes">
    <p v-if="!scopes.length" class="scopes__empty">{{ t("adminGroup.scopes.empty") }}</p>
    <div v-for="(scope, index) in scopes" :key="index" class="scope">
      <AdminFormField v-model="scope.path" :label="t('adminGroup.scopes.path')" :help="t('adminGroup.scopes.pathHelp')" />
      <AdminFormField
        :model-value="presetOf(scope.bits)"
        kind="select"
        :label="t('adminGroup.scopes.permission')"
        :options="options"
        @update:model-value="setPreset(scope, $event)"
      />
      <div class="scope__actions">
        <FluentButton tone="subtle" :aria-expanded="expanded.has(scope)" @click="toggle(scope)">
          {{ expanded.has(scope) ? t("adminGroup.scopes.hideBits") : t("adminGroup.scopes.showBits") }}
        </FluentButton>
        <FluentButton tone="subtle" @click="remove(index)">
          <FluentSvgIcon :svg="icons.deleteIcon" :size="18" />
          {{ t("adminGroup.scopes.remove") }}
        </FluentButton>
      </div>
      <div v-if="expanded.has(scope)" class="scope__bits"><PermissionBits v-model="scope.bits" /></div>
    </div>
    <FluentButton @click="scopes.push(emptyScope())">
      <FluentSvgIcon :svg="icons.add" :size="18" />
      {{ t("adminGroup.scopes.add") }}
    </FluentButton>
  </div>
</template>

<style scoped>
.scopes {
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: flex-start;
}
.scopes__empty {
  margin: 0;
  font-size: 13px;
  color: var(--fluent-muted);
}
.scope {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-self: stretch;
  padding: 12px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.scope__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.scope__bits {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
</style>
