<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, nextTick, ref, watch } from "vue"
import { RouterLink, useRouter } from "vue-router"
import { FluentMenu, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { useMedia } from "@/browse/useMedia"
import { icons } from "@/utils/icons"
import { encodePath, normalizePath, splitPath } from "@/utils/path"

const { t } = useI18n()
const router = useRouter()
const props = defineProps<{ path: string }>()

const compact = useMedia("(max-width: 640px)")
const crumbs = computed(() => {
  const parts = splitPath(props.path)
  return parts.map((name, i) => ({ name, to: encodePath(parts.slice(0, i + 1).join("/")) }))
})
// On phones only the last segment stays inline; the rest move into a menu
const hidden = computed(() => (compact.value ? crumbs.value.slice(0, -1) : []))
const visible = computed(() => (compact.value ? crumbs.value.slice(-1) : crumbs.value))
const hiddenItems = computed(() => hidden.value.map((c) => ({ value: c.to, label: c.name })))

const menuOpen = ref(false)
const menuAnchor = ref<HTMLElement | null>(null)

const scroller = ref<HTMLElement | null>(null)
watch(
  () => [props.path, compact.value],
  async () => {
    await nextTick()
    if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth
  },
  { immediate: true, flush: "post" },
)

const editing = ref(false)
const draft = ref("")
const field = ref<HTMLInputElement | null>(null)

async function edit() {
  draft.value = normalizePath(props.path)
  editing.value = true
  await nextTick()
  field.value?.focus()
  field.value?.select()
}

function go() {
  editing.value = false
  void router.push(encodePath(draft.value))
}
</script>

<template>
  <div class="address">
    <form v-if="editing" class="address__form" @submit.prevent="go">
      <input
        ref="field"
        v-model="draft"
        class="address__input"
        type="text"
        :aria-label="t('explorer.nav.address')"
        :title="t('explorer.nav.addressHint')"
        autocomplete="off"
        spellcheck="false"
        @keydown.esc.stop="editing = false"
        @blur="editing = false"
      />
    </form>
    <nav v-else ref="scroller" class="crumbs" :aria-label="t('browse.breadcrumb.label')">
      <ol>
        <li>
          <RouterLink to="/" class="crumb crumb--home" :title="t('browse.breadcrumb.root')" :aria-label="t('browse.breadcrumb.root')">
            <FluentSvgIcon :svg="icons.home" :size="18" />
          </RouterLink>
        </li>
        <li v-if="hidden.length">
          <FluentSvgIcon class="sep" :svg="icons.chevronRight" :size="12" />
          <span ref="menuAnchor" class="menu-anchor">
            <button class="crumb crumb--button" type="button" :aria-label="t('explorer.nav.hiddenPath')" aria-haspopup="menu" @click="menuOpen = !menuOpen">
              <FluentSvgIcon :svg="icons.moreHorizontal" :size="16" />
            </button>
            <FluentMenu
              v-model:open="menuOpen"
              :label="t('explorer.nav.hiddenPath')"
              :anchor="menuAnchor"
              :items="hiddenItems"
              @select="(to: string) => router.push(to)"
            />
          </span>
        </li>
        <li v-for="(crumb, i) in visible" :key="crumb.to">
          <FluentSvgIcon class="sep" :svg="icons.chevronRight" :size="12" />
          <span v-if="i === visible.length - 1" class="crumb crumb--current" aria-current="page">{{ crumb.name }}</span>
          <RouterLink v-else :to="crumb.to" class="crumb">{{ crumb.name }}</RouterLink>
        </li>
        <li class="fill" :title="t('explorer.nav.editAddress')" @click="edit" />
      </ol>
    </nav>
  </div>
</template>

<style scoped>
.address {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 34px;
  box-sizing: border-box;
  padding: 0 4px;
  background: var(--fluent-control);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.address:focus-within {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: 1px;
}
.address__form {
  flex: 1;
  min-width: 0;
}
.address__input {
  width: 100%;
  height: 28px;
  padding: 0 6px;
  box-sizing: border-box;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fluent-text);
  font: inherit;
}
.crumbs {
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.crumbs::-webkit-scrollbar {
  display: none;
}
ol {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
  white-space: nowrap;
}
li {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}
.fill {
  flex: 1;
  align-self: stretch;
  min-width: 16px;
  cursor: text;
}
.menu-anchor {
  display: inline-flex;
}
.sep {
  color: var(--fluent-muted);
}
.crumb {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--fluent-radius);
  background: none;
  color: var(--fluent-text);
  font: inherit;
  text-decoration: none;
  transition: var(--motion-fill);
}
a.crumb:hover,
.crumb--button:hover {
  background: var(--fluent-control-hover);
}
a.crumb:active,
.crumb--button:active {
  background: var(--fluent-control-pressed);
}
a.crumb:focus-visible,
.crumb--button:focus-visible {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: -2px;
}
.crumb--button {
  cursor: pointer;
}
.crumb--current {
  font-weight: 600;
}
</style>
