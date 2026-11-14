<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { useRoute, useRouter } from "vue-router"
import { FluentButton, FluentProgressBar } from "@platform-kit/fluent/vue"
import Breadcrumb from "@/components/Breadcrumb.vue"
import PasswordDialog from "@/components/PasswordDialog.vue"
import StateMessage from "@/components/StateMessage.vue"
import { siteTitle } from "@/stores/session"
import { icons } from "@/utils/icons"
import { encodePath, isReservedPath, normalizePath, parentPath, splitPath } from "@/utils/path"
import FileView from "./FileView.vue"
import FolderView from "./FolderView.vue"
import { useBrowse } from "./useBrowse"

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
  router.push(encodePath(parentPath(path.value)))
}
</script>

<template>
  <main class="page">
    <Breadcrumb :path="path" />

    <div class="content" :aria-busy="loading">
      <FluentProgressBar v-if="loading" class="content__bar" indeterminate label="加载中" />

      <StateMessage
        v-if="notFound"
        :icon="icons.folderOpen"
        title="找不到这个位置"
        detail="路径不存在，或者已被移动、删除。"
      >
        <FluentButton v-if="path !== '/'" @click="up">返回上一级</FluentButton>
        <FluentButton tone="primary" @click="router.push('/')">回到首页</FluentButton>
      </StateMessage>

      <div v-else-if="initial && !locked" class="skeleton" aria-hidden="true">
        <span v-for="n in 8" :key="n" class="skeleton__row" />
      </div>

      <StateMessage v-else-if="locked" :icon="icons.lockClosed" title="此位置需要密码" detail="输入访问密码后才能查看内容。">
        <FluentButton tone="primary" @click="dialogOpen = true">输入密码</FluentButton>
      </StateMessage>

      <StateMessage
        v-else-if="error"
        :icon="icons.warning"
        :title="error.kind === 'network' ? '无法连接到服务器' : '加载失败'"
        :detail="error.message"
      >
        <FluentButton tone="primary" @click="reload()">重试</FluentButton>
      </StateMessage>

      <template v-else-if="resource">
        <div :inert="loading || undefined" :class="{ stale: loading }">
          <FolderView
            v-if="resource.kind === 'folder'"
            :path="resource.path"
            :list="resource.list"
            :refreshing="loading"
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
  max-width: 1120px;
  margin: 0 auto;
  padding: 12px max(16px, env(safe-area-inset-right)) 48px max(16px, env(safe-area-inset-left));
  box-sizing: border-box;
}
.content {
  position: relative;
  min-height: 60vh;
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
  padding: 44px 0 0;
}
.skeleton__row {
  height: 44px;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-alt);
  border: 1px solid var(--fluent-border);
}
</style>
