<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { useI18n } from "vue-i18n"
import { RouterLink } from "vue-router"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import { adminGet, adminList } from "@/admin/api"
import AdminPage from "@/admin/components/AdminPage.vue"
import { session } from "@/stores/session"
import { icons, systemIcons } from "@/utils/icons"

interface Storage {
  status?: string
  disabled?: boolean
}
interface User {
  disabled?: boolean
}
interface IndexProgress {
  obj_count: number
  is_done: boolean
  last_done_time: string | null
  error: string
}

interface Stat {
  label: string
  value: string
  detail: string
  to: string
  tone: "ok" | "warn" | "danger" | "neutral"
}

const { t } = useI18n()

const loading = ref(false)
const storages = ref<Storage[] | null>(null)
const users = ref<User[] | null>(null)
const metas = ref<unknown[] | null>(null)
const progress = ref<IndexProgress | null>(null)
let controller: AbortController | null = null

async function load() {
  controller?.abort()
  const mine = (controller = new AbortController())
  loading.value = true
  const settle = async <T,>(promise: Promise<T>): Promise<T | null> => {
    try {
      return await promise
    } catch {
      return null
    }
  }
  const [s, u, m, p] = await Promise.all([
    settle(adminList<Storage>("/storage/list", undefined, mine.signal)),
    settle(adminList<User>("/user/list", undefined, mine.signal)),
    settle(adminList<unknown>("/meta/list", undefined, mine.signal)),
    settle(adminGet<IndexProgress>("/index/progress", undefined, mine.signal)),
  ])
  if (controller !== mine) return
  storages.value = s
  users.value = u
  metas.value = m
  progress.value = p
  loading.value = false
}

onMounted(load)
onBeforeUnmount(() => controller?.abort())

const unavailable = computed(() => t("adminOverview.unavailable"))

const stats = computed<Stat[]>(() => {
  const list: Stat[] = []
  const s = storages.value
  if (s) {
    const disabled = s.filter((x) => x.disabled).length
    const working = s.filter((x) => !x.disabled && x.status === "work").length
    const failing = s.length - disabled - working
    list.push({
      label: t("adminOverview.storages"),
      value: String(s.length),
      detail: t("adminOverview.storageDetail", { working, failing, disabled }),
      to: "/@manage/storage",
      tone: failing > 0 ? "danger" : "ok",
    })
  } else list.push({ label: t("adminOverview.storages"), value: "-", detail: unavailable.value, to: "/@manage/storage", tone: "neutral" })

  const u = users.value
  if (u) {
    const disabled = u.filter((x) => x.disabled).length
    list.push({
      label: t("adminOverview.users"),
      value: String(u.length),
      detail: t("adminOverview.userDetail", { disabled }),
      to: "/@manage/user",
      tone: "neutral",
    })
  } else list.push({ label: t("adminOverview.users"), value: "-", detail: unavailable.value, to: "/@manage/user", tone: "neutral" })

  const m = metas.value
  list.push({
    label: t("adminOverview.metas"),
    value: m ? String(m.length) : "-",
    detail: m ? t("adminOverview.metaDetail") : unavailable.value,
    to: "/@manage/meta",
    tone: "neutral",
  })

  const p = progress.value
  if (p) {
    const state = p.error ? t("adminOverview.indexError") : p.is_done ? t("adminOverview.indexReady") : t("adminOverview.indexRunning")
    list.push({
      label: t("adminOverview.index"),
      value: String(p.obj_count),
      detail: state,
      to: "/@manage/index",
      tone: p.error ? "danger" : p.is_done ? "ok" : "warn",
    })
  } else list.push({ label: t("adminOverview.index"), value: "-", detail: unavailable.value, to: "/@manage/index", tone: "neutral" })
  return list
})

const version = computed(() => (typeof session.settings?.version === "string" ? session.settings.version : ""))
</script>

<template>
  <AdminPage :description="t('adminOverview.description')">
    <template #actions>
      <FluentButton tone="subtle" :disabled="loading" @click="load">
        <FluentSvgIcon :svg="icons.arrowClockwise" :size="18" />
        {{ t("admin.actions.refresh") }}
      </FluentButton>
    </template>

    <div class="cards">
      <RouterLink v-for="stat in stats" :key="stat.to" class="card" :to="stat.to">
        <span class="card__label">{{ stat.label }}</span>
        <span class="card__value">{{ stat.value }}</span>
        <span class="card__detail" :class="`card__detail--${stat.tone}`">{{ stat.detail }}</span>
      </RouterLink>
    </div>

    <p v-if="version" class="version">
      <FluentSvgIcon :svg="systemIcons.board" :size="16" />
      {{ t("adminOverview.version", { version }) }}
    </p>
  </AdminPage>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px;
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
  color: inherit;
  text-decoration: none;
}
.card:hover {
  background: rgb(128 128 128 / 0.1);
}
.card__label {
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
.card__value {
  font-size: 2rem;
  font-weight: 600;
  line-height: 1.2;
}
.card__detail {
  font-size: 0.85rem;
  color: var(--fluent-muted);
}
.card__detail--danger {
  color: var(--fluent-danger-text, var(--fluent-danger));
}
.card__detail--ok {
  color: var(--fluent-success-text, var(--fluent-success, inherit));
}
.version {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 24px 0 0;
  color: var(--fluent-muted);
  font-size: 0.85rem;
}
</style>
