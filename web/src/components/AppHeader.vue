<script setup lang="ts">
import { computed } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink, useRoute, useRouter } from "vue-router"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import AccountMenu from "@/components/AccountMenu.vue"
import MenuButton from "@/components/MenuButton.vue"
import { localeOptions, type Locale } from "@/i18n/locales"
import { prefs, resolvedTheme, toggleTheme } from "@/stores/prefs"
import SearchBox from "@/search/SearchBox.vue"
import { isGuest, rememberReturnPath, session, siteTitle } from "@/stores/session"
import { getToken } from "@/api"
import { icons } from "@/utils/icons"

defineProps<{ navToggle?: boolean; navOpen?: boolean }>()
defineEmits<{ "toggle-nav": [] }>()

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const themeIcon = computed(() => (resolvedTheme.value === "dark" ? icons.weatherMoon : icons.weatherSunny))

const hasToken = !!getToken()

function login() {
  rememberReturnPath(route.fullPath)
  router.push("/@login")
}
</script>

<template>
  <header class="header">
    <FluentButton
      v-if="navToggle"
      class="header__nav-toggle"
      tone="subtle"
      icon-only
      :aria-label="navOpen ? t('shell.header.closeNav') : t('shell.header.openNav')"
      :aria-expanded="navOpen"
      @click="$emit('toggle-nav')"
    >
      <FluentSvgIcon :svg="icons.navigation" :size="20" />
    </FluentButton>
    <RouterLink to="/" class="brand">
      <img v-if="session.settings?.logo" class="brand__logo" :src="String(session.settings.logo)" alt="" />
      <span class="brand__title">{{ siteTitle }}</span>
    </RouterLink>

    <div class="header__search" data-slot="header-search"><slot name="search"><SearchBox /></slot></div>

    <div class="header__tools">
      <MenuButton
        :icon="icons.translate"
        :label="t('shell.header.language')"
        :items="localeOptions"
        :model-value="prefs.locale"
        @select="(v) => (prefs.locale = v as Locale)"
      />
      <FluentButton tone="subtle" icon-only :aria-label="t('shell.header.toggleTheme')" :title="t('shell.header.toggleTheme')" @click="toggleTheme">
        <FluentSvgIcon :svg="themeIcon" :size="20" />
      </FluentButton>
      <span v-if="!session.ready && hasToken" class="header__pending" aria-hidden="true" />
      <FluentButton v-else-if="isGuest" tone="subtle" @click="login">
        <FluentSvgIcon :svg="icons.person" :size="20" />
        {{ t("shell.header.login") }}
      </FluentButton>
      <AccountMenu v-else />
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
  flex: none;
  position: relative;
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
.header__nav-toggle {
  flex: none;
  margin-inline-end: -8px;
}
@media (min-width: 901px) {
  .header__nav-toggle {
    display: none;
  }
}
@media (max-width: 640px) {
  .brand__title {
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
