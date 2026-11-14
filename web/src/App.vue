<script setup lang="ts">
import { watchEffect } from "vue"
import { RouterView } from "vue-router"
import { FluentTheme } from "@platform-kit/fluent/vue"
import AppHeader from "@/components/AppHeader.vue"
import FileOpsHost from "@/components/FileOpsHost.vue"
import ToastHost from "@/components/ToastHost.vue"
import UploadPanel from "@/components/UploadPanel.vue"
import { prefs } from "@/stores/prefs"
import { session } from "@/stores/session"

watchEffect(() => {
  const favicon = session.settings?.favicon
  if (!favicon) return
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
  if (!link) {
    link = document.createElement("link")
    link.rel = "icon"
    document.head.appendChild(link)
  }
  link.href = String(favicon)
})
</script>

<template>
  <FluentTheme :mode="prefs.theme" class="app">
    <AppHeader />
    <RouterView />
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
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--fluent-bg);
}
a {
  color: var(--fluent-accent-link);
}
</style>
