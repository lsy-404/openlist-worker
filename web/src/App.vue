<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import { useI18n } from "vue-i18n"
import { RouterView, useRoute } from "vue-router"
import { FluentButton, FluentTheme } from "@platform-kit/fluent/vue"
import AppFrame from "@/components/AppFrame.vue"
import FileOpsHost from "@/components/FileOpsHost.vue"
import UploadPanel from "@/components/UploadPanel.vue"
import StateMessage from "@/components/StateMessage.vue"
import ToastHost from "@/components/ToastHost.vue"
import { prefs, resolvedTheme } from "@/stores/prefs"
import { loadSession, session, siteTitle } from "@/stores/session"
import { icons } from "@/utils/icons"

const { t } = useI18n()
const route = useRoute()
const hasSidebar = computed(() => route.matched.some((record) => !!record.components?.sidebar && (record.meta.showSidebar?.() ?? true)))
const retrying = ref(false)

function headElement(selector: string, create: () => HTMLElement): HTMLElement {
  let el = document.head.querySelector<HTMLElement>(selector)
  if (!el) {
    el = create()
    document.head.appendChild(el)
  }
  return el
}

function metaTag(name: string): HTMLMetaElement {
  return headElement(`meta[name='${name}']`, () => {
    const meta = document.createElement("meta")
    meta.name = name
    return meta
  }) as HTMLMetaElement
}

watchEffect(() => {
  const icon = session.settings?.favicon || session.settings?.logo
  if (!icon) return
  const link = headElement("link[rel~='icon']", () => {
    const el = document.createElement("link")
    el.rel = "icon"
    return el
  }) as HTMLLinkElement
  link.href = String(icon)
})

watchEffect(() => {
  if (route.path.startsWith("/@") && !route.path.startsWith("/@manage")) document.title = siteTitle.value
})

watchEffect(() => {
  metaTag("robots").content = session.settings?.allow_indexed === "true" ? "index, follow" : "noindex, nofollow"
})

watchEffect(() => {
  metaTag("theme-color").content = resolvedTheme.value === "dark" ? "#202020" : "#f3f3f3"
})

async function retry() {
  retrying.value = true
  await loadSession()
  retrying.value = false
}
</script>

<template>
  <FluentTheme :mode="prefs.theme" class="app">
    <AppFrame :sidebar="hasSidebar">
      <template #sidebar><RouterView name="sidebar" /></template>
      <StateMessage
        v-if="session.ready && session.unreachable"
        class="app__offline"
        :icon="icons.warning"
        :title="t('shell.offline.title')"
        :detail="t('shell.offline.detail')"
      >
        <FluentButton tone="primary" :busy="retrying" @click="retry">{{ t("common.retry") }}</FluentButton>
      </StateMessage>
      <RouterView v-else />
    </AppFrame>
    <FileOpsHost />
    <UploadPanel />
    <ToastHost />
  </FluentTheme>
</template>

<style>
html,
body {
  margin: 0;
  background: var(--fluent-bg);
}
body {
  color: var(--fluent-text);
  font: 14px/1.5 var(--fluent-font);
  -webkit-text-size-adjust: 100%;
}
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--fluent-bg);
}
a {
  color: var(--fluent-accent-link);
}
</style>
