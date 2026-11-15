<script setup lang="ts">
import { ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { adminPost } from "@/admin/api"
import { askConfirm } from "@/stores/dialogs"
import { notify } from "@/stores/toast"
import { icons, systemIcons } from "@/utils/icons"

const props = defineProps<{ token: string }>()
const emit = defineEmits<{ reset: [] }>()

const { t } = useI18n()
const shown = ref(false)

async function copy() {
  try {
    await navigator.clipboard.writeText(props.token)
    notify(t("adminSettings.token.copied"), "success")
  } catch {
    notify(t("adminSettings.token.copyFailed"), "danger")
  }
}

async function reset() {
  const attempted = await askConfirm({
    title: t("adminSettings.token.resetTitle"),
    message: t("adminSettings.token.resetMessage"),
    confirmLabel: t("adminSettings.token.resetConfirm"),
    danger: true,
    async run() {
      await adminPost("/setting/reset_token")
    },
  })
  if (!attempted) return
  notify(t("adminSettings.token.resetDone"), "success")
  emit("reset")
}
</script>

<template>
  <div class="token">
    <div class="token__head">
      <strong>{{ t("adminSettings.token.title") }}</strong>
      <span class="token__help">{{ t("adminSettings.token.help") }}</span>
    </div>
    <code class="token__value">{{ token ? (shown ? token : "•".repeat(24)) : t("adminSettings.token.none") }}</code>
    <div class="token__actions">
      <FluentButton tone="subtle" :disabled="!token" @click="shown = !shown">
        <FluentSvgIcon :svg="shown ? systemIcons.eyeOff : systemIcons.eye" :size="18" />
        {{ shown ? t("adminSettings.token.hide") : t("adminSettings.token.show") }}
      </FluentButton>
      <FluentButton tone="subtle" :disabled="!token" @click="copy">
        <FluentSvgIcon :svg="icons.copy" :size="18" />
        {{ t("adminSettings.token.copy") }}
      </FluentButton>
      <FluentButton @click="reset">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("adminSettings.token.reset") }}
      </FluentButton>
    </div>
  </div>
</template>

<style scoped>
.token {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.token__head {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.token__help {
  font-size: 0.8rem;
  color: var(--fluent-muted);
}
.token__value {
  overflow-wrap: anywhere;
  font-family: ui-monospace, monospace;
}
.token__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
