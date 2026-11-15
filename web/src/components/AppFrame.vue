<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import AppFooter from "@/components/AppFooter.vue"
import AppHeader from "@/components/AppHeader.vue"
import TabStrip from "@/tabs/TabStrip.vue"
import { state as tabState } from "@/tabs/store"

defineProps<{ sidebar?: boolean }>()

const { t } = useI18n()
const route = useRoute()
const open = ref(false)
const showTabs = computed(() => route.path !== "/@login" && tabState.tabs.length > 0)

watch(() => route.fullPath, () => (open.value = false))

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false
}
watch(open, (value) => {
  if (value) window.addEventListener("keydown", onKey)
  else window.removeEventListener("keydown", onKey)
})
onBeforeUnmount(() => window.removeEventListener("keydown", onKey))
</script>

<template>
  <div class="frame">
    <AppHeader :nav-toggle="sidebar" :nav-open="open" @toggle-nav="open = !open">
      <template #search><slot name="search" /></template>
    </AppHeader>
    <div class="frame__body">
      <template v-if="sidebar">
        <aside class="frame__pane" :class="{ 'frame__pane--open': open }" :aria-label="t('shell.header.navigation')">
          <slot name="sidebar" />
        </aside>
        <Transition name="scrim">
          <div v-if="open" class="frame__scrim" aria-hidden="true" @click="open = false" />
        </Transition>
      </template>
      <div class="frame__card" :class="{ 'frame__card--flush': !sidebar, 'frame__card--tabs': showTabs }">
        <TabStrip v-if="showTabs" class="frame__tabs" />
        <div id="frame-toolbar" class="frame__toolbar"><slot name="toolbar" /></div>
        <div class="frame__content"><slot /></div>
        <div id="frame-status" class="frame__status" />
        <AppFooter />
      </div>
    </div>
  </div>
</template>

<style scoped>
.frame {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.frame__body {
  display: flex;
  flex: 1;
  gap: 4px;
  padding: 0 max(8px, env(safe-area-inset-right)) 8px max(0px, env(safe-area-inset-left));
  min-width: 0;
}
.frame__pane {
  position: sticky;
  top: 56px;
  align-self: flex-start;
  flex: none;
  box-sizing: border-box;
  width: 256px;
  height: calc(100dvh - 56px);
  padding: 8px;
  overflow-y: auto;
}
.frame__card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  background: var(--fluent-surface);
  border: 1px solid var(--fluent-border);
  border-radius: calc(var(--fluent-panel-radius) + 4px);
}
.frame__card--flush {
  margin-inline-start: 8px;
}
.frame__card--tabs {
  --tabs-h: 36px;
}
.frame__tabs {
  position: sticky;
  top: 56px;
  z-index: 6;
}
.frame__toolbar {
  position: sticky;
  top: calc(56px + var(--tabs-h, 0px));
  z-index: 5;
  background: var(--fluent-surface);
  border-bottom: 1px solid var(--fluent-border);
  border-radius: calc(var(--fluent-panel-radius) + 4px) calc(var(--fluent-panel-radius) + 4px) 0 0;
}
.frame__status {
  position: sticky;
  bottom: 0;
  z-index: 5;
  background: var(--fluent-surface);
  border-top: 1px solid var(--fluent-border);
}
.frame__toolbar:empty,
.frame__status:empty {
  display: none;
}
.frame__content {
  flex: 1;
  min-width: 0;
}
.frame__scrim {
  display: none;
}
@media (max-width: 900px) {
  .frame__body {
    padding-inline: 8px;
  }
  .frame__card--flush {
    margin-inline-start: 0;
  }
  .frame__pane {
    position: fixed;
    inset: 56px auto 0 0;
    align-self: stretch;
    z-index: 9;
    width: min(300px, 85vw);
    height: auto;
    background: var(--fluent-acrylic);
    border-inline-end: 1px solid var(--fluent-border);
    box-shadow: var(--fluent-shadow);
    transform: translateX(-102%);
    visibility: hidden;
    transition:
      transform var(--fluent-fast) var(--fluent-ease-accelerate),
      visibility 0s linear var(--fluent-fast);
  }
  .frame__pane--open {
    transform: none;
    visibility: visible;
    transition:
      transform var(--fluent-normal) var(--fluent-ease),
      visibility 0s;
  }
  .frame__scrim {
    display: block;
    position: fixed;
    inset: 56px 0 0;
    z-index: 8;
    background: rgba(0, 0, 0, 0.35);
  }
  .scrim-enter-active {
    transition: opacity var(--fluent-normal) var(--fluent-ease);
  }
  .scrim-leave-active {
    transition: opacity var(--fluent-fast) var(--fluent-ease-accelerate);
  }
  .scrim-enter-from,
  .scrim-leave-to {
    opacity: 0;
  }
}
</style>
