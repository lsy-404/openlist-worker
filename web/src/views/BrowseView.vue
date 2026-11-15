<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FluentButton, FluentProgressBar } from "@platform-kit/fluent/vue"
import BrowseToolbar from "@/browse/BrowseToolbar.vue"
import StatusBar from "@/browse/StatusBar.vue"
import { useCommands } from "@/browse/commands"
import { syncFolder } from "@/browse/tree"
import { useShortcuts } from "@/browse/useShortcuts"
import PasswordDialog from "@/components/PasswordDialog.vue"
import StateMessage from "@/components/StateMessage.vue"
import { siteTitle } from "@/stores/session"
import { icons } from "@/utils/icons"
import { encodePath, isReservedPath, normalizePath, parentPath, splitPath } from "@/utils/path"
import FileView from "./FileView.vue"
import FolderView from "./FolderView.vue"
import { useBrowse } from "./useBrowse"

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

const path = computed(() => normalizePath([route.params.pathMatch].flat().join("/")))
const reserved = computed(() => isReservedPath(path.value))

const { resource, loading, error, locked, wrongPassword, submitting, reload, submitPassword } = useBrowse(path)

const dialogOpen = ref(false)
watch(locked, (value) => (dialogOpen.value = value), { immediate: true })

const initial = computed(() => loading.value && !resource.value)
const notFound = computed(() => reserved.value || error.value?.kind === "not-found")

watch(
  [path, siteTitle],
  () => {
    const name = splitPath(path.value).pop()
    document.title = name ? `${name} - ${siteTitle.value}` : siteTitle.value
  },
  { immediate: true },
)

function up() {
  if (path.value !== "/") router.push(encodePath(parentPath(path.value)))
}

const list = computed(() => (resource.value?.kind === "folder" ? resource.value.list : null))
// Commands follow the listing on screen, which lags the route while the next folder loads
const listPath = computed(() => resource.value?.path ?? path.value)
const { commands, entries } = useCommands(listPath, list, reload)
useShortcuts({ commands: () => (list.value ? commands.value : null), up, reload })

watch(resource, (value) => {
  if (value?.kind === "folder") syncFolder(value.path, value.list.content ?? [])
})
</script>

<template>
  <main class="page">
    <Teleport to="#frame-toolbar" defer>
      <BrowseToolbar :path="path" :commands="list ? commands : null" :filterable="entries.length > 0" :loading="loading" @up="up" @refresh="reload()" />
    </Teleport>
    <Teleport to="#frame-status" defer>
      <StatusBar v-if="list" :entries="entries" />
    </Teleport>

    <div class="content" :aria-busy="loading">
      <FluentProgressBar v-if="loading" class="content__bar" indeterminate :label="t('common.loading')" />

      <StateMessage
        v-if="notFound"
        :icon="icons.folderOpen"
        :title="t('browse.state.notFound')"
        :detail="t('browse.state.notFoundDetail')"
      >
        <FluentButton v-if="path !== '/'" @click="up">{{ t("browse.state.up") }}</FluentButton>
        <FluentButton tone="primary" @click="router.push('/')">{{ t("browse.state.home") }}</FluentButton>
      </StateMessage>

      <div v-else-if="initial && !locked" class="skeleton" aria-hidden="true">
        <span v-for="n in 8" :key="n" class="skeleton__row" />
      </div>

      <StateMessage v-else-if="locked" :icon="icons.lockClosed" :title="t('browse.state.locked')" :detail="t('browse.state.lockedDetail')">
        <FluentButton tone="primary" @click="dialogOpen = true">{{ t("browse.state.enterPassword") }}</FluentButton>
      </StateMessage>

      <StateMessage
        v-else-if="error"
        :icon="icons.warning"
        :title="error.kind === 'network' ? t('errors.network') : t('errors.loadFailed')"
        :detail="error.message"
      >
        <FluentButton tone="primary" @click="reload()">{{ t("common.retry") }}</FluentButton>
      </StateMessage>

      <template v-else-if="resource">
        <div :inert="loading || undefined" :class="{ stale: loading }">
          <FolderView
            v-if="resource.kind === 'folder'"
            :path="resource.path"
            :list="resource.list"
            @refresh="reload"
          />
          <FileView v-else :path="resource.path" :file="resource.file" @refresh="reload" />
        </div>
      </template>
    </div>

    <PasswordDialog
      :open="dialogOpen"
      :path="path"
      :wrong="wrongPassword"
      :busy="submitting"
      @submit="submitPassword"
      @cancel="dialogOpen = false"
    />
  </main>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
}
.content {
  position: relative;
  min-height: 50vh;
}
.content__bar {
  position: absolute;
  top: -6px;
  left: 0;
  right: 0;
  z-index: 1;
}
.stale {
  opacity: 0.55;
  transition: opacity var(--fluent-fast) var(--fluent-ease);
}
.skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 0 0;
}
.skeleton__row {
  height: 44px;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-alt);
  border: 1px solid var(--fluent-border);
}
</style>
