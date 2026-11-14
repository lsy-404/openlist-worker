<script setup lang="ts">
import { computed } from "vue"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import MenuButton from "@/components/MenuButton.vue"
import { prefs, type ThemeMode } from "@/stores/prefs"
import SearchBox from "@/search/SearchBox.vue"
import { isGuest, logout, rememberReturnPath, roleLabel, session, siteTitle } from "@/stores/session"
import { getToken } from "@/api"
import { icons } from "@/utils/icons"

const route = useRoute()
const router = useRouter()

const themeItems = [
  { value: "light", label: "浅色" },
  { value: "dark", label: "深色" },
  { value: "system", label: "跟随系统" },
]
const themeIcon = computed(() => (prefs.theme === "dark" ? icons.weatherMoon : prefs.theme === "light" ? icons.weatherSunny : icons.desktop))

const hasToken = !!getToken()
const userItems = computed(() => [
  { value: "profile", label: `${session.user?.username ?? ""} · ${roleLabel.value}`, disabled: true },
  { value: "logout", label: "退出登录" },
])

function login() {
  rememberReturnPath(route.fullPath)
  router.push("/@login")
}

function onUser(value: string) {
  if (value === "logout") void logout()
}
</script>

<template>
  <header class="header">
    <RouterLink to="/" class="brand">
      <img v-if="session.settings?.logo" class="brand__logo" :src="String(session.settings.logo)" alt="" />
      <span class="brand__title">{{ siteTitle }}</span>
    </RouterLink>

    <div class="header__search" data-slot="header-search"><slot name="search"><SearchBox /></slot></div>

    <div class="header__tools">
      <MenuButton
        :icon="themeIcon"
        label="主题"
        :items="themeItems"
        :model-value="prefs.theme"
        @select="(v) => (prefs.theme = v as ThemeMode)"
      />
      <span v-if="!session.ready && hasToken" class="header__pending" aria-hidden="true" />
      <FluentButton v-else-if="isGuest" tone="subtle" @click="login">
        <FluentSvgIcon :svg="icons.person" :size="20" />
        登录
      </FluentButton>
      <template v-else>
        <MenuButton
          :icon="icons.person"
          :text="session.user?.username"
          label="账户"
          :items="userItems"
          @select="onUser"
        />
        <span class="header__role">{{ roleLabel }}</span>
      </template>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 56px;
  padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
  background: var(--fluent-mica);
  border-bottom: 1px solid var(--fluent-border);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 10;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  color: var(--fluent-text);
  text-decoration: none;
  border-radius: var(--fluent-radius);
}
.brand:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: 2px;
}
.brand__logo {
  width: 28px;
  height: 28px;
  object-fit: contain;
  flex: none;
}
.brand__title {
  font-size: 1.05rem;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.header__search {
  flex: 1;
  min-width: 0;
}
.header__pending {
  width: 88px;
  height: 32px;
}
.header__role {
  padding: 1px 8px;
  border: 1px solid var(--fluent-border);
  border-radius: 999px;
  color: var(--fluent-muted);
  font-size: 0.75rem;
  white-space: nowrap;
}
@media (max-width: 640px) {
  .header__role {
    display: none;
  }
}
.header__tools {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-inline-start: auto;
  flex: none;
}
</style>
