<script setup lang="ts">
import { computed, ref, watchEffect } from "vue"
import { useI18n } from "vue-i18n"
import { RouterView, useRoute } from "vue-router"
import { FluentButton, FluentTheme } from "@platform-kit/fluent/vue"
import AppFrame from "@/components/AppFrame.vue"
import FileOpsHost from "@/components/FileOpsHost.vue"
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
.fluent-theme,
[data-fluent-theme],
[data-fluent-speed],
[data-fluent-reduced-motion] {
  --motion-ease-move: cubic-bezier(0.33, 0, 0.67, 1);
  --motion-rise: 12px;
  --motion-fill: background-color var(--fluent-faster) var(--fluent-ease), color var(--fluent-faster) var(--fluent-ease);
}
.collapse-enter-active,
.collapse-leave-active {
  overflow: hidden;
}
.collapse-enter-active {
  transition:
    height var(--fluent-normal) var(--fluent-ease),
    opacity var(--fluent-normal) var(--fluent-ease);
}
.collapse-leave-active {
  transition:
    height var(--fluent-fast) var(--fluent-ease-accelerate),
    opacity var(--fluent-fast) var(--fluent-ease-accelerate);
}
.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
}
@keyframes motion-rise {
  from {
    opacity: 0;
    transform: translateY(var(--motion-rise));
  }
}
.fluent-dialog {
  transition:
    opacity var(--fluent-fast) var(--fluent-ease-accelerate),
    overlay var(--fluent-fast) allow-discrete,
    display var(--fluent-fast) allow-discrete;
}
.fluent-dialog::backdrop {
  transition:
    opacity var(--fluent-fast) var(--fluent-ease-accelerate),
    overlay var(--fluent-fast) allow-discrete,
    display var(--fluent-fast) allow-discrete;
}
.fluent-dialog:not([open]) {
  opacity: 0;
  pointer-events: none;
}
.fluent-dialog:not([open])::backdrop {
  opacity: 0;
}
.fluent-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
/* Icons are rasterised as black images, so they are inverted wherever the text around them is light */
[data-fluent-theme="dark"] :is(.fluent-svg-icon__paint, .fluent-icon-text__paint) img,
[data-fluent-theme="light"] :is(.fluent-button--primary, .fluent-button--danger) :is(.fluent-svg-icon__paint, .fluent-icon-text__paint) img {
  filter: invert(1);
}
[data-fluent-theme="dark"] :is(.fluent-button--primary, .fluent-button--danger) :is(.fluent-svg-icon__paint, .fluent-icon-text__paint) img {
  filter: none;
}
</style>
