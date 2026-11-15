<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useRoute } from "vue-router"
import AppFooter from "@/components/AppFooter.vue"
import AppHeader from "@/components/AppHeader.vue"
import TabStrip from "@/tabs/TabStrip.vue"
import { setScroller } from "@/tabs/scroll"
import { state as tabState } from "@/tabs/store"

defineProps<{ sidebar?: boolean }>()

const { t } = useI18n()
const route = useRoute()
const open = ref(false)
const content = ref<HTMLElement | null>(null)
const showTabs = computed(() => route.path !== "/@login" && tabState.tabs.length > 0)

watch(() => route.fullPath, () => (open.value = false))

function onKey(event: KeyboardEvent) {
  if (event.key === "Escape") open.value = false
}
watch(open, (value) => {
  if (value) window.addEventListener("keydown", onKey)
  else window.removeEventListener("keydown", onKey)
})
onMounted(() => setScroller(content.value))
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey)
  setScroller(null)
})
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
        <div ref="content" class="frame__content">
          <slot />
          <AppFooter />
        </div>
        <div id="frame-status" class="frame__status" />
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
  min-height: 0;
  min-width: 0;
  padding: 0 max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(0px, env(safe-area-inset-left));
}
.frame__pane {
  flex: none;
  box-sizing: border-box;
  width: 256px;
  padding: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.frame__card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
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
  flex: none;
}
.frame__toolbar {
  flex: none;
  background: var(--fluent-surface);
  border-bottom: 1px solid var(--fluent-border);
}
.frame__status {
  flex: none;
  background: var(--fluent-surface);
  border-top: 1px solid var(--fluent-border);
}
.frame__toolbar:empty,
.frame__status:empty {
  display: none;
}
.frame__content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.frame__content > :deep(*) {
  flex-shrink: 0;
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
    z-index: 9;
    width: min(300px, 85vw);
    padding-bottom: max(8px, env(safe-area-inset-bottom));
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
