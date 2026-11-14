<script setup lang="ts">
import { onMounted } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FluentProgressRing } from "@platform-kit/fluent/vue"
import { setToken } from "@/api"
import { loadUser, takeReturnPath } from "@/stores/session"

const route = useRoute()
const router = useRouter()

onMounted(async () => {
  const token = route.query.token
  if (typeof token === "string" && token) {
    setToken(token)
    await loadUser()
    await router.replace(takeReturnPath())
    return
  }
  location.replace("/api/auth/sso?method=sso_get_token")
})
</script>

<template>
  <main class="login" role="status">
    <FluentProgressRing :size="32" indeterminate label="正在登录" />
    <p>正在跳转到登录…</p>
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
