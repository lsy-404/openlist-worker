<script setup lang="ts">
import { useI18n } from "vue-i18n"
import AdminFormField from "@/admin/components/AdminFormField.vue"
import { PERMISSION_GROUPS, PERMISSION_KEYS } from "./types"

const { t } = useI18n()
const bits = defineModel<boolean[]>({ required: true })
</script>

<template>
  <template v-for="group in PERMISSION_GROUPS" :key="group.key">
    <h3 class="section">{{ t(`adminUser.groups.${group.key}`) }}</h3>
    <AdminFormField
      v-for="bit in group.bits"
      :key="bit"
      v-model="bits[bit]"
      kind="switch"
      :label="t(`adminUser.permissions.${PERMISSION_KEYS[bit]}`)"
    />
  </template>
</template>

<style scoped>
.section {
  margin: 8px 0 0;
  font-size: 13px;
  font-weight: 600;
}
</style>
