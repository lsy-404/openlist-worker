<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { useRouter } from "vue-router"
import { FluentButton, FluentPopover, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { isAdmin, logout, roleLabel, session } from "@/stores/session"
import { icons } from "@/utils/icons"
import { useFlyout } from "@/utils/useFlyout"

const { t } = useI18n()
const router = useRouter()
const { open, closing, toggle, requestClose, onAnimationEnd } = useFlyout()
const anchor = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)

function run(action: () => void) {
  requestClose()
  action()
}

function onKey(event: KeyboardEvent) {
  const items = [...(menu.value?.querySelectorAll<HTMLElement>("[role='menuitem']") ?? [])]
  if (!items.length) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const step = { ArrowDown: 1, ArrowUp: -1 }[event.key]
  let next: number
  if (step) next = at < 0 ? (step > 0 ? 0 : items.length - 1) : (at + step + items.length) % items.length
  else if (event.key === "Home") next = 0
  else if (event.key === "End") next = items.length - 1
  else return
  event.preventDefault()
  items[next].focus()
}
</script>

<template>
  <span ref="anchor" class="account">
    <FluentButton
      tone="subtle"
      :aria-label="t('shell.header.account')"
      :title="t('shell.header.account')"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggle"
    >
      <FluentSvgIcon :svg="icons.person" :size="20" />
      <span class="account__name">{{ session.user?.username }}</span>
    </FluentButton>
    <FluentPopover
      :open="open"
      :anchor="anchor"
      :label="t('shell.header.account')"
      role="menu"
      :class="['fluent-popover--menu', 'account-flyout', 'flyout-motion', { 'flyout-motion--closing': closing }]"
      @update:open="requestClose"
      @animationend="onAnimationEnd"
      @keydown="onKey"
    >
      <div ref="menu">
        <div class="account__identity" role="presentation">
          <span class="account__user">{{ session.user?.username }}</span>
          <span class="account__role">{{ roleLabel }}</span>
          <ul v-if="session.user?.groups?.length" class="account__groups" :aria-label="t('shell.header.groups')">
            <li v-for="group in session.user.groups" :key="group.id" class="account__chip">{{ group.name }}</li>
          </ul>
        </div>
        <div class="fluent-menu__separator" role="separator" />
        <div class="fluent-menu" role="presentation">
          <button v-if="isAdmin" class="fluent-menu__item" type="button" role="menuitem" @click="run(() => router.push('/@manage'))">
            <FluentSvgIcon :svg="icons.settings" :size="16" />
            <span class="fluent-menu__item-label">{{ t("shell.header.admin") }}</span>
          </button>
          <button class="fluent-menu__item" type="button" role="menuitem" @click="run(() => void logout())">
            <FluentSvgIcon :svg="icons.signOut" :size="16" />
            <span class="fluent-menu__item-label">{{ t("shell.header.logout") }}</span>
          </button>
        </div>
      </div>
    </FluentPopover>
  </span>
</template>

<style scoped>
.account {
  display: inline-flex;
}
.account__name {
  max-width: 14ch;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.account__identity {
  display: grid;
  gap: 2px;
  padding: 8px 8px 10px;
}
.account__user {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.account__role {
  color: var(--fluent-muted);
  font-size: 0.8rem;
}
.account__groups {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}
.account__chip {
  padding: 1px 8px;
  border: 1px solid var(--fluent-border);
  border-radius: 999px;
  background: var(--fluent-control-hover);
  font-size: 0.75rem;
  line-height: 1.5;
}
</style>

<style>
.account-flyout.fluent-popover {
  max-width: min(320px, calc(100vw - 16px));
}
</style>
