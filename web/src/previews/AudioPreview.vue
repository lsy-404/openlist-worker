<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import { fetchFile } from "./fetch"
import { proxyUrl } from "./download"
import PreviewToolbar from "./PreviewToolbar.vue"
import SiblingNav from "./SiblingNav.vue"
import { previewIcons } from "./icons"
import { isAudio, isImage, stem } from "./kinds"
import { parseLyrics, type LyricLine } from "./lyrics"
import { entryUrl } from "./links"
import type { PreviewProps } from "./registry"
import { settingFlag, settingText } from "./settings"
import { handoff, useSiblings } from "./useSiblings"
import { decode } from "./useTextFile"

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const nav = useSiblings(() => ({ path: props.path, related: props.file.related }), isAudio)

const audio = ref<HTMLAudioElement>()
const lyricsBox = ref<HTMLElement>()
const failed = ref(false)
const src = ref(props.downloadUrl)
const lyrics = ref<LyricLine[]>([])
const activeLine = ref(-1)
const coverFailed = ref(false)
let triedProxy = false

const COVER_NAMES = new Set(["cover", "folder", "front"])

const cover = computed(() => {
  const own = stem(props.file.name).toLowerCase()
  const images = nav.all.filter(isImage)
  const match = images.find((e) => stem(e.name).toLowerCase() === own) ?? images.find((e) => COVER_NAMES.has(stem(e.name).toLowerCase()))
  if (match) return entryUrl(nav.dir, match)
  return props.file.thumb || settingText("audio_cover") || ""
})

const lyricsEntry = computed(() => {
  const own = stem(props.file.name).toLowerCase()
  return nav.all.find((e) => e.name.toLowerCase() === `${own}.lrc`)
})

watch(
  () => [props.downloadUrl, cover.value],
  () => (coverFailed.value = false),
)

watch(
  () => props.downloadUrl,
  (url) => {
    failed.value = false
    src.value = url
    triedProxy = false
    activeLine.value = -1
  },
)

watch(
  lyricsEntry,
  async (entry) => {
    lyrics.value = []
    if (!entry) return
    try {
      const res = await fetchFile(entryUrl(nav.dir, entry))
      const parsed = parseLyrics(decode(await res.arrayBuffer()).text)
      if (lyricsEntry.value === entry) lyrics.value = parsed
    } catch {
      lyrics.value = []
    }
  },
  { immediate: true },
)

function onError() {
  const fallback = triedProxy ? null : proxyUrl(src.value)
  if (fallback) {
    triedProxy = true
    src.value = fallback
  } else {
    failed.value = true
  }
}

function onLoaded() {
  if (settingFlag("audio_autoplay") || handoff.play) void audio.value?.play().catch(() => undefined)
  handoff.play = false
}

function onEnded() {
  if (nav.hasNext) nav.next(true)
  else if (nav.total > 1) nav.goTo(nav.siblings[0].name)
}

function onTime() {
  const time = audio.value?.currentTime ?? 0
  let index = -1
  for (let i = 0; i < lyrics.value.length && lyrics.value[i].time <= time; i++) index = i
  if (index === activeLine.value) return
  activeLine.value = index
  void nextTick(() => {
    const box = lyricsBox.value
    const line = box?.children[index] as HTMLElement | undefined
    if (box && line) box.scrollTo({ top: line.offsetTop - box.clientHeight / 2 + line.clientHeight / 2, behavior: "smooth" })
  })
}

function syncSession() {
  if (!("mediaSession" in navigator)) return
  navigator.mediaSession.metadata = new MediaMetadata({
    title: stem(props.file.name),
    artwork: cover.value && !coverFailed.value ? [{ src: new URL(cover.value, location.origin).href }] : [],
  })
  navigator.mediaSession.setActionHandler("previoustrack", nav.hasPrev ? () => nav.goTo(nav.siblings[nav.index - 1].name) : null)
  navigator.mediaSession.setActionHandler("nexttrack", nav.hasNext ? () => nav.next(true) : null)
}

watch(() => [props.file.name, cover.value, nav.index, nav.total], syncSession)
onMounted(syncSession)
onBeforeUnmount(() => {
  if (!("mediaSession" in navigator)) return
  navigator.mediaSession.metadata = null
  navigator.mediaSession.setActionHandler("previoustrack", null)
  navigator.mediaSession.setActionHandler("nexttrack", null)
})
</script>

<template>
  <PreviewNotice
    v-if="failed"
    tone="error"
    :title="t('preview.audio.errorTitle')"
    :detail="t('preview.audio.errorDetail')"
    :download-url="downloadUrl"
    :filename="file.name"
  />
  <div v-else class="audio">
    <PreviewToolbar>
      <SiblingNav :nav="nav" />
    </PreviewToolbar>
    <div class="audio__main">
      <img v-if="cover && !coverFailed" class="audio__cover" :src="cover" :alt="t('preview.audio.cover')" @error="coverFailed = true" />
      <div v-else class="audio__cover audio__cover--empty"><FluentSvgIcon :svg="previewIcons.musicNote" :size="56" /></div>
      <div class="audio__side">
        <p class="audio__title">{{ stem(file.name) }}</p>
        <audio
          :key="src"
          ref="audio"
          class="audio__player"
          :src="src"
          controls
          preload="metadata"
          @loadedmetadata="onLoaded"
          @timeupdate="onTime"
          @ended="onEnded"
          @error="onError"
        />
        <div v-if="lyrics.length" ref="lyricsBox" class="lyrics" :aria-label="t('preview.audio.lyrics')">
          <p v-for="(line, i) in lyrics" :key="i" class="lyrics__line" :class="{ 'lyrics__line--active': i === activeLine }">{{ line.text || "·" }}</p>
        </div>
      </div>
    </div>
    <ol v-if="nav.total > 1" class="playlist" :aria-label="t('preview.audio.playlist')">
      <li v-for="(entry, i) in nav.siblings" :key="entry.name">
        <button class="playlist__item" :class="{ 'playlist__item--current': i === nav.index }" :aria-current="i === nav.index || undefined" @click="nav.goTo(entry.name)">
          <span class="playlist__no">{{ i + 1 }}</span>
          <span class="playlist__name">{{ entry.name }}</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.audio__main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 20px;
  padding: 20px 16px;
}
.audio__cover {
  flex: none;
  width: min(100%, 220px);
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-alt);
}
.audio__cover--empty {
  display: grid;
  place-items: center;
  color: var(--fluent-muted);
}
.audio__side {
  flex: 1;
  min-width: min(100%, 260px);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.audio__title {
  margin: 0;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.audio__player {
  width: 100%;
}
.lyrics {
  max-height: 220px;
  overflow-y: auto;
  padding: 8px 0;
  text-align: center;
  color: var(--fluent-muted);
}
.lyrics__line {
  margin: 0;
  padding: 3px 8px;
  transition: color var(--fluent-fast) var(--fluent-ease);
}
.lyrics__line--active {
  color: var(--fluent-text);
  font-weight: 600;
}
.playlist {
  margin: 0;
  padding: 0;
  max-height: 280px;
  overflow-y: auto;
  list-style: none;
  border-top: 1px solid var(--fluent-border);
}
.playlist__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 8px 16px;
  text-align: start;
  font: inherit;
  color: var(--fluent-text);
  background: none;
  border: 0;
  cursor: pointer;
  transition: var(--motion-fill);
}
.playlist__item:hover {
  background: var(--fluent-control-hover);
}
.playlist__item--current {
  font-weight: 600;
  background: var(--fluent-control);
}
.playlist__no {
  flex: none;
  min-width: 2em;
  color: var(--fluent-muted);
  font-variant-numeric: tabular-nums;
}
.playlist__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
