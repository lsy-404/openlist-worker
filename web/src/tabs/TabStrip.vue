<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { icons } from "@/utils/icons"
import { describeLocation } from "./describe"
import { activateTab, closeTab, openTab, state, tabLocation } from "./store"

const { t } = useI18n()
const router = useRouter()
const scroller = ref<HTMLElement | null>(null)

const items = computed(() =>
  state.tabs.map((tab) => ({ id: tab.id, active: tab.id === state.active, ...describeLocation(router, tabLocation(tab)) })),
)

watch(
  () => state.active,
  async () => {
    await nextTick()
    scroller.value?.querySelector("[aria-selected='true']")?.scrollIntoView({ block: "nearest", inline: "nearest" })
  },
  { immediate: true, flush: "post" },
)

function onWheel(event: WheelEvent) {
  if (!scroller.value || event.deltaX) return
  scroller.value.scrollLeft += event.deltaY
}

function onAux(event: MouseEvent, id: string) {
  if (event.button === 1) {
    event.preventDefault()
    closeTab(id)
  }
}

function onKey(event: KeyboardEvent, id: string) {
  if (event.key === "Delete") closeTab(id)
  else if (event.key === "Enter" || event.key === " ") {
    event.preventDefault()
    activateTab(id)
  }
}
</script>

<template>
  <div class="strip">
    <div ref="scroller" class="strip__scroll" role="tablist" :aria-label="t('tabs.label')" @wheel.passive="onWheel">
      <div
        v-for="item in items"
        :key="item.id"
        class="tab"
        :class="{ 'tab--active': item.active }"
        role="tab"
        tabindex="0"
        :aria-selected="item.active"
        :title="item.title"
        @click="activateTab(item.id)"
        @mousedown.middle.prevent
        @auxclick="onAux($event, item.id)"
        @keydown="onKey($event, item.id)"
      >
        <FluentSvgIcon class="tab__icon" :svg="item.icon" :size="16" />
        <span class="tab__title">{{ item.title }}</span>
        <button class="tab__close" type="button" tabindex="-1" :aria-label="t('tabs.close', { name: item.title })" :title="t('tabs.closeShort')" @click.stop="closeTab(item.id)">
          <FluentSvgIcon :svg="icons.dismiss" :size="12" />
        </button>
      </div>
    </div>
    <FluentButton class="strip__add" tone="subtle" icon-only :aria-label="t('tabs.new')" :title="t('tabs.new')" @click="openTab('/')">
      <FluentSvgIcon :svg="icons.add" :size="16" />
    </FluentButton>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: var(--tabs-h);
  padding: 4px 8px 0 12px;
  box-sizing: border-box;
  background: var(--fluent-bg);
  border-radius: calc(var(--fluent-panel-radius) + 4px) calc(var(--fluent-panel-radius) + 4px) 0 0;
}
.strip__scroll {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.strip__scroll::-webkit-scrollbar {
  display: none;
}
.tab {
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 0 1 auto;
  width: 200px;
  min-width: 52px;
  height: 32px;
  padding: 0 6px 0 10px;
  box-sizing: border-box;
  border-radius: 8px 8px 0 0;
  color: var(--fluent-muted);
  cursor: default;
  user-select: none;
}
.tab:hover {
  background: var(--fluent-control-hover);
  color: var(--fluent-text);
}
.tab--active {
  width: 220px;
  min-width: 112px;
  background: var(--fluent-surface);
  color: var(--fluent-text);
}
.tab:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.tab__icon {
  flex: none;
}
.tab__title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.85rem;
}
.tab__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: inherit;
  cursor: pointer;
}
.tab__close:hover {
  background: var(--fluent-control-hover);
}
.strip__add {
  flex: none;
  align-self: center;
  min-width: 28px;
  height: 28px;
  padding: 0;
}
@media (max-width: 640px) {
  .strip {
    padding-inline: 4px;
  }
  .tab {
    flex-basis: 120px;
    padding-inline-start: 8px;
    gap: 6px;
  }
  .tab--active {
    flex-basis: 150px;
    min-width: 80px;
  }
}
</style>
