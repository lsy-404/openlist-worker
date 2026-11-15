<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FluentProgressRing } from "@platform-kit/fluent/vue"
import { getToken, setToken } from "@/api"
import { loadUser, rememberReturnPath, safeReturnPath, takeReturnPath } from "@/stores/session"
import { notify } from "@/stores/toast"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
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
  <main class="login" role="status">
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
