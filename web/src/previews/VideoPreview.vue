<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { FluentProgressRing, FluentSelect } from "@platform-kit/fluent/vue"
import { extension } from "@/utils/format"
import { fetchBuffer, reachableUrl } from "./fetch"
import { proxyUrl } from "./download"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import SiblingNav from "./SiblingNav.vue"
import { isSubtitle, isVideo, stem } from "./kinds"
import { entryUrl } from "./links"
import type { PreviewProps } from "./registry"
import { settingFlag } from "./settings"
import { subtitleToUrl } from "./subtitles"
import { handoff, useSiblings } from "./useSiblings"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const nav = useSiblings(() => ({ path: props.path, related: props.file.related }), isVideo)

const video = ref<HTMLVideoElement>()
const status = ref<"loading" | "ready" | "error">("loading")
const detail = ref("")
const src = ref(props.downloadUrl)
const rate = ref("1")
const subtitle = ref("")
const subtitleUrl = ref("")
const quality = ref("-1")
const levels = ref<{ value: string; label: string }[]>([])
let triedProxy = false
let teardown: (() => void) | null = null
let applyQuality: ((level: number) => void) | null = null

const kind = computed(() => {
  const ext = extension(props.file.name)
  return ext === "m3u8" ? "hls" : ext === "flv" || ext === "m2ts" ? "mpegts" : "native"
})

// Only subtitle files named after the video belong to it
const subtitles = computed(() => {
  const own = stem(props.file.name).toLowerCase()
  return nav.all.filter((e) => isSubtitle(e) && stem(e.name).toLowerCase().startsWith(own))
})
const subtitleOptions = computed(() => [
  { value: "", label: t("preview.video.subtitleOff") },
  ...subtitles.value.map((e) => ({ value: e.name, label: e.name })),
])
const rateOptions = ["0.5", "0.75", "1", "1.25", "1.5", "2"].map((v) => ({ value: v, label: `${v}×` }))
const qualityOptions = computed(() => [{ value: "-1", label: t("preview.video.qualityAuto") }, ...levels.value])

function release() {
  teardown?.()
  teardown = null
  applyQuality = null
  levels.value = []
  quality.value = "-1"
}

async function attach() {
  release()
  const el = video.value
  if (!el || kind.value === "native") return
  try {
    // Segment and stream requests are made by script, so they need an address the page may read
    const url = await reachableUrl(props.downloadUrl)
    if (kind.value === "hls") {
      const { default: Hls } = await import("hls.js")
      if (!Hls.isSupported()) {
        if (el.canPlayType("application/vnd.apple.mpegurl")) el.src = url
        else throw new Error("unsupported")
        return
      }
      const hls = new Hls({ enableWorker: false })
      hls.loadSource(url)
      hls.attachMedia(el)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        levels.value = hls.levels
          .map((level, index) => ({ level, index }))
          .sort((a, b) => b.level.height - a.level.height)
          .map(({ level, index }) => ({
            value: String(index),
            label: level.height ? `${level.height}p` : `${Math.round(level.bitrate / 1000)} kbps`,
          }))
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) fail(t("preview.video.network"))
      })
      applyQuality = (level) => (hls.currentLevel = level)
      teardown = () => hls.destroy()
    } else {
      const { default: mpegts } = await import("mpegts.js")
      if (!mpegts.isSupported()) throw new Error("unsupported")
      const player = mpegts.createPlayer({ type: extension(props.file.name), url }, { enableWorker: false })
      player.attachMediaElement(el)
      player.load()
      player.on(mpegts.Events.ERROR, () => fail(t("preview.video.generic")))
      teardown = () => player.destroy()
    }
  } catch {
    fail(t("preview.video.unsupported"))
  }
}

function fail(message: string) {
  detail.value = message
  status.value = "error"
}

function onError() {
  if (kind.value !== "native") return
  const fallback = triedProxy ? null : proxyUrl(src.value)
  if (fallback) {
    triedProxy = true
    src.value = fallback
    return
  }
  const code = video.value?.error?.code
  fail(
    code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
      ? t("preview.video.unsupported")
      : code === MediaError.MEDIA_ERR_NETWORK
        ? t("preview.video.network")
        : t("preview.video.generic"),
  )
}

function onLoaded() {
  status.value = "ready"
  if (video.value) video.value.playbackRate = Number(rate.value)
  if (settingFlag("video_autoplay") || handoff.play) void video.value?.play().catch(() => undefined)
  handoff.play = false
}

function onEnded() {
  if (nav.hasNext) nav.next(true)
}

function clearSubtitle() {
  if (subtitleUrl.value) URL.revokeObjectURL(subtitleUrl.value)
  subtitleUrl.value = ""
}

watch(subtitle, async (name) => {
  clearSubtitle()
  const entry = subtitles.value.find((e) => e.name === name)
  if (!entry) return
  try {
    const url = subtitleToUrl(await fetchBuffer(entryUrl(nav.dir, entry)), extension(entry.name))
    if (subtitle.value === name) subtitleUrl.value = url
    else URL.revokeObjectURL(url)
  } catch {
    subtitle.value = ""
  }
})

watch(quality, (value) => applyQuality?.(Number(value)))

watch(rate, (value) => {
  if (video.value) video.value.playbackRate = Number(value)
})

watch(
  () => props.downloadUrl,
  (url) => {
    status.value = "loading"
    src.value = url
    triedProxy = false
    subtitle.value = ""
    release()
    void nextTick(attach)
  },
)

// The first subtitle is picked as soon as the folder listing arrives
watch(
  () => [props.file.name, subtitles.value.length],
  () => {
    if (!subtitle.value && subtitles.value.length) subtitle.value = subtitles.value[0].name
  },
)

onMounted(() => void attach())
onBeforeUnmount(() => {
  release()
  clearSubtitle()
})
</script>

<template>
  <div class="video">
    <PreviewToolbar>
      <SiblingNav :nav="nav" />
      <span class="spacer" />
      <FluentSelect v-if="subtitles.length" v-model="subtitle" :options="subtitleOptions" :label="t('preview.video.subtitles')" />
      <FluentSelect v-if="levels.length" v-model="quality" :options="qualityOptions" :label="t('preview.video.quality')" />
      <FluentSelect v-model="rate" :options="rateOptions" :label="t('preview.video.speed')" />
    </PreviewToolbar>
    <PreviewNotice
      v-if="status === 'error'"
      tone="error"
      :title="t('preview.video.errorTitle')"
      :detail="detail"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <div v-show="status !== 'error'" class="video__frame">
      <video
        :key="downloadUrl"
        ref="video"
        class="video__player"
        :src="kind === 'native' ? src : undefined"
        controls
        playsinline
        preload="metadata"
        @loadedmetadata="onLoaded"
        @ended="onEnded"
        @error="onError"
      >
        <track v-if="subtitleUrl" :key="subtitleUrl" kind="subtitles" :src="subtitleUrl" :label="subtitle" default />
      </video>
      <div v-if="status === 'loading'" class="video__loading">
        <FluentProgressRing indeterminate :size="32" :label="t('common.loading')" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.video__frame {
  position: relative;
  background: #000;
}
.video__player {
  display: block;
  width: 100%;
  max-height: 78vh;
  min-height: 180px;
}
.video__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  pointer-events: none;
}
</style>
