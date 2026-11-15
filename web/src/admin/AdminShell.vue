<script setup lang="ts">
import { computed, watchEffect } from "vue"
import { useI18n } from "vue-i18n"
import { RouterView, useRoute, useRouter } from "vue-router"
import { FluentButton, FluentProgressRing } from "@platform-kit/fluent/vue"
import StateMessage from "@/components/StateMessage.vue"
import { isAdmin, isGuest, rememberReturnPath, session, siteTitle } from "@/stores/session"
import { icons } from "@/utils/icons"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const state = computed(() => (!session.ready ? "loading" : isGuest.value ? "guest" : isAdmin.value ? "admin" : "denied"))

watchEffect(() => {
  if (state.value !== "guest") return
  rememberReturnPath(route.fullPath)
  void router.replace("/@login")
})

watchEffect(() => {
  const title = route.meta.title ? t(route.meta.title) : t("admin.title")
  document.title = `${title} - ${siteTitle.value}`
})
</script>

<template>
  <RouterView v-if="state === 'admin'" />
  <div v-else-if="state !== 'denied'" class="shell__wait">
    <FluentProgressRing :size="32" indeterminate :label="t('common.loading')" />
  </div>
  <StateMessage v-else :icon="icons.lockClosed" :title="t('admin.denied.title')" :detail="t('admin.denied.detail')">
    <FluentButton tone="primary" @click="router.push('/')">{{ t("admin.back") }}</FluentButton>
  </StateMessage>
</template>

<style scoped>
.shell__wait {
  display: flex;
  justify-content: center;
  padding: 96px 16px;
}
</style>
