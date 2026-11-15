<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FluentButton, FluentProgressRing } from "@platform-kit/fluent/vue"
import { getToken, setToken } from "@/api"
import { loadUser, rememberReturnPath, safeReturnPath, takeReturnPath } from "@/stores/session"
import StateMessage from "@/components/StateMessage.vue"
import { icons } from "@/utils/icons"
import { notify } from "@/stores/toast"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const denied = computed(() => route.query.error === "sso_denied")

function retry() {
  location.replace("/api/auth/sso?method=sso_get_token")
}

onMounted(async () => {
  if (denied.value) return
  const { token, redirect } = route.query
  const target = safeReturnPath(redirect)
  if (typeof token === "string" && token) {
    // The token must not stay in the address bar or history
    history.replaceState(history.state, "", "/@login")
    setToken(token)
    await loadUser()
    const remembered = takeReturnPath()
    if (!getToken()) notify(t("errors.login.failed"), "danger")
    await router.replace(target ?? remembered)
    return
  }
  if (target) rememberReturnPath(target)
  location.replace("/api/auth/sso?method=sso_get_token")
})
</script>

<template>
  <StateMessage v-if="denied" :icon="icons.lockClosed" :title="t('errors.login.denied')" :detail="t('errors.login.deniedDetail')">
    <FluentButton tone="primary" @click="retry">{{ t("errors.login.retry") }}</FluentButton>
    <FluentButton @click="router.replace('/')">{{ t("errors.login.backToFiles") }}</FluentButton>
  </StateMessage>
  <main v-else class="login" role="status">
    <FluentProgressRing :size="32" indeterminate :label="t('errors.login.signingIn')" />
    <p>{{ t("errors.login.redirecting") }}</p>
  </main>
</template>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 96px 16px;
  color: var(--fluent-muted);
}
p {
  margin: 0;
}
</style>
