<script setup lang="ts">
import { computed, ref } from "vue"
import { useI18n } from "vue-i18n"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { adminGet } from "@/admin/api"
import AdminPage from "@/admin/components/AdminPage.vue"
import { useAdminList } from "@/admin/useAdminList"
import StateMessage from "@/components/StateMessage.vue"
import { icons } from "@/utils/icons"
import SettingsSection from "./SettingsSection.vue"
import TokenCard from "./TokenCard.vue"
import { GROUP_LABELS, GROUP_ORDER, TOKEN_KEY, UNUSED_KEYS, type Setting, type SettingsSectionDef } from "./types"

const { t } = useI18n()

const { rows, loading, error, reload } = useAdminList((signal) =>
  adminGet<Setting[] | null>("/setting/list", undefined, signal).then((list) => list ?? []),
)

const isUnused = (item: Setting) => UNUSED_KEYS.has(item.key) || item.flag === 3

const sections = computed<SettingsSectionDef[]>(() => {
  const byGroup = new Map<number, Setting[]>()
  for (const item of rows.value) {
    if (isUnused(item) || item.key === TOKEN_KEY) continue
    const list = byGroup.get(item.group) ?? []
    list.push(item)
    byGroup.set(item.group, list)
  }
  const extra = [...byGroup.keys()].filter((g) => !GROUP_ORDER.includes(g)).sort((a, b) => a - b)
  return [...GROUP_ORDER.filter((g) => byGroup.has(g)), ...extra].map((group) => ({
    id: `g${group}`,
    group,
    labelKey: GROUP_LABELS[group] ?? "unknown",
    items: byGroup.get(group)!,
  }))
})

// The token lives in group 14, so that section exists whenever the token does
const tokenItem = computed(() => rows.value.find((item) => item.key === TOKEN_KEY))
const allSections = computed<SettingsSectionDef[]>(() => {
  const list = sections.value
  if (!tokenItem.value || list.some((s) => s.group === tokenItem.value!.group)) return list
  const group = tokenItem.value.group
  return [...list, { id: `g${group}`, group, labelKey: GROUP_LABELS[group] ?? "unknown", items: [] }]
})

const unused = computed(() => rows.value.filter(isUnused))

const selected = ref<string | null>(null)
const current = computed(() => allSections.value.find((s) => s.id === selected.value)?.id ?? allSections.value[0]?.id)

const sectionLabel = (s: SettingsSectionDef) =>
  s.labelKey === "unknown" ? t("adminSettings.groups.unknown", { n: s.group }) : t(`adminSettings.groups.${s.labelKey}`)
const sectionDescription = (s: SettingsSectionDef) => (s.labelKey === "unknown" ? undefined : t(`adminSettings.groupHelp.${s.labelKey}`))
</script>

<template>
  <AdminPage :description="t('adminSettings.description')">
    <template #actions>
      <FluentButton tone="subtle" :disabled="loading" @click="reload">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("admin.actions.refresh") }}
      </FluentButton>
    </template>

    <StateMessage v-if="error" :icon="icons.warning" :title="t('admin.table.error')" :detail="error">
      <FluentButton tone="primary" @click="reload">{{ t("common.retry") }}</FluentButton>
    </StateMessage>
    <p v-else-if="loading && !rows.length" class="settings__loading">{{ t("common.loading") }}</p>
    <template v-else>
      <div class="settings__tabs" role="tablist">
        <button
          v-for="section in allSections"
          :id="`tab-${section.id}`"
          :key="section.id"
          class="settings__tab"
          type="button"
          role="tab"
          :aria-selected="current === section.id"
          :aria-controls="`panel-${section.id}`"
          @click="selected = section.id"
        >
          {{ sectionLabel(section) }}
        </button>
      </div>
      <div
        v-for="section in allSections"
        v-show="current === section.id"
        :id="`panel-${section.id}`"
        :key="section.id"
        class="settings__card"
        role="tabpanel"
        :aria-labelledby="`tab-${section.id}`"
      >
        <SettingsSection :items="section.items" :group="section.group" :description="sectionDescription(section)" @saved="reload">
          <template v-if="tokenItem && section.group === tokenItem.group" #before>
            <TokenCard :token="tokenItem.value" @reset="reload" />
          </template>
        </SettingsSection>
      </div>

      <details v-if="unused.length" class="settings__legacy">
        <summary>{{ t("adminSettings.legacy.title") }}</summary>
        <div class="settings__card">
          <SettingsSection :items="unused" :group="null" :description="t('adminSettings.legacy.description')" @saved="reload" />
        </div>
      </details>
    </template>
  </AdminPage>
</template>

<style scoped>
.settings__loading {
  color: var(--fluent-muted);
}
.settings__tabs {
  display: flex;
  gap: 4px;
  overflow-x: auto;
  border-bottom: 1px solid var(--fluent-border);
}
.settings__tab {
  flex: none;
  padding: 8px 14px;
  border: 0;
  border-bottom: 2px solid transparent;
  background: none;
  color: inherit;
  font: inherit;
  cursor: pointer;
  transition: var(--motion-fill), border-color var(--fluent-fast) var(--fluent-ease);
}
.settings__tab:hover {
  background: rgb(128 128 128 / 0.12);
}
.settings__tab[aria-selected="true"] {
  border-bottom-color: var(--fluent-accent, currentColor);
  font-weight: 600;
}
.settings__card {
  margin-top: 16px;
}
.settings__legacy {
  margin-top: 32px;
}
.settings__legacy summary {
  cursor: pointer;
  color: var(--fluent-muted);
}
</style>
