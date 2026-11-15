<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import SiblingNav from "./SiblingNav.vue"
import { previewIcons } from "./icons"
import { fetchBuffer } from "./fetch"
import { decodeHeif, HEIF_EXTENSIONS } from "./heif"
import { isImage } from "./kinds"
import type { PreviewProps } from "./registry"
import { extension } from "@/utils/format"
import { useSiblings } from "./useSiblings"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

const MAX_SCALE = 10
const stage = ref<HTMLElement>()
const image = ref<HTMLImageElement>()
const status = ref<"loading" | "ready" | "error">("loading")
const natural = ref({ w: 0, h: 0 })
const scale = ref(1)
const tx = ref(0)
const ty = ref(0)
const dragging = ref(false)
const rotation = ref(0)
const box = ref({ w: 0, h: 0 })
let observer: ResizeObserver | null = null
const src = ref(props.downloadUrl)
let decodedUrl = ""
let triedDecode = false

const nav = useSiblings(() => ({ path: props.path, related: props.file.related }), isImage)

watch(
  () => props.downloadUrl,
  (url) => {
    status.value = "loading"
    releaseDecoded()
    src.value = url
    triedDecode = false
    rotation.value = 0
    reset()
  },
)

function reset() {
  scale.value = 1
  tx.value = 0
  ty.value = 0
}

function releaseDecoded() {
  if (decodedUrl) URL.revokeObjectURL(decodedUrl)
  decodedUrl = ""
}

// Browsers without native HEIC support get a client-side decode before the image is declared broken
async function onError() {
  if (!triedDecode && HEIF_EXTENSIONS.has(extension(props.file.name))) {
    triedDecode = true
    const url = props.downloadUrl
    try {
      const blob = await decodeHeif(await fetchBuffer(url))
      if (url !== props.downloadUrl) return
      decodedUrl = URL.createObjectURL(blob)
      src.value = decodedUrl
      return
    } catch {
      /* falls through to the error state */
    }
  }
  status.value = "error"
}

function rotate(step: number) {
  rotation.value += step
  zoomTo(1)
  reset()
}

function onLoad() {
  const img = image.value
  if (!img) return
  natural.value = { w: img.naturalWidth, h: img.naturalHeight }
  status.value = "ready"
}

// Size of the image as laid out at scale 1 (object-fit: contain), taking quarter turns into account
function fitSize() {
  const box = stage.value
  if (!box || !natural.value.w) return { w: 0, h: 0 }
  const turned = Math.abs(rotation.value / 90) % 2 === 1
  const w = turned ? natural.value.h : natural.value.w
  const h = turned ? natural.value.w : natural.value.h
  const ratio = Math.min(box.clientWidth / w, box.clientHeight / h, 1)
  return { w: w * ratio, h: h * ratio }
}

function clamp() {
  const box = stage.value
  if (!box) return
  const fit = fitSize()
  const limitX = Math.max(0, (fit.w * scale.value - box.clientWidth) / 2)
  const limitY = Math.max(0, (fit.h * scale.value - box.clientHeight) / 2)
  tx.value = Math.min(limitX, Math.max(-limitX, tx.value))
  ty.value = Math.min(limitY, Math.max(-limitY, ty.value))
}

// Zoom keeping the point under (cx, cy), relative to the stage centre, fixed
function zoomTo(next: number, cx = 0, cy = 0) {
  const target = Math.min(MAX_SCALE, Math.max(1, next))
  const k = target / scale.value
  tx.value = cx - (cx - tx.value) * k
  ty.value = cy - (cy - ty.value) * k
  scale.value = target
  if (target === 1) reset()
  else clamp()
}

function centred(e: { clientX: number; clientY: number }) {
  const rect = stage.value!.getBoundingClientRect()
  return { x: e.clientX - rect.left - rect.width / 2, y: e.clientY - rect.top - rect.height / 2 }
}

function onWheel(e: WheelEvent) {
  if (status.value !== "ready") return
  const { x, y } = centred(e)
  zoomTo(scale.value * Math.exp(-e.deltaY * 0.0015), x, y)
}

const pointers = new Map<number, { x: number; y: number }>()
let moved = 0
let pinchStart = 0
let pinchScale = 1

function onPointerDown(e: PointerEvent) {
  if (status.value !== "ready") return
  stage.value!.setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) moved = 0
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    pinchStart = Math.hypot(a.x - b.x, a.y - b.y)
    pinchScale = scale.value
  }
}

function onPointerMove(e: PointerEvent) {
  const last = pointers.get(e.pointerId)
  if (!last) return
  const current = { x: e.clientX, y: e.clientY }
  pointers.set(e.pointerId, current)
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()]
    const mid = centred({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 })
    moved = 10
    zoomTo(pinchScale * (Math.hypot(a.x - b.x, a.y - b.y) / pinchStart), mid.x, mid.y)
    return
  }
  moved += Math.abs(current.x - last.x) + Math.abs(current.y - last.y)
  if (scale.value > 1 && moved > 3) {
    dragging.value = true
    tx.value += current.x - last.x
    ty.value += current.y - last.y
    clamp()
  }
}

function onPointerUp(e: PointerEvent) {
  const wasSingle = pointers.size === 1
  pointers.delete(e.pointerId)
  dragging.value = false
  if (wasSingle && moved <= 3 && status.value === "ready") {
    const { x, y } = centred(e)
    if (scale.value > 1) zoomTo(1)
    else zoomTo(2.5, x, y)
  }
}

function openOriginal() {
  window.open(props.downloadUrl, "_blank", "noopener")
}

function onKey(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  if (e.altKey || e.ctrlKey || e.metaKey || el?.closest("input, textarea, select, audio, video")) return
  if (e.key === "ArrowLeft" && nav.hasPrev) nav.prev()
  else if (e.key === "ArrowRight" && nav.hasNext) nav.next()
  else if (e.key === "+" || e.key === "=") zoomTo(scale.value * 1.5)
  else if (e.key === "-") zoomTo(scale.value / 1.5)
  else if (e.key === "0") reset()
  else if (e.key === "r") rotate(e.shiftKey ? -90 : 90)
}

onMounted(() => {
  window.addEventListener("keydown", onKey)
  observer = new ResizeObserver(() => {
    if (stage.value) box.value = { w: stage.value.clientWidth, h: stage.value.clientHeight }
  })
  if (stage.value) observer.observe(stage.value)
})
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey)
  observer?.disconnect()
  releaseDecoded()
})

const transform = computed(() => `translate(-50%, -50%) translate(${tx.value}px, ${ty.value}px) scale(${scale.value}) rotate(${rotation.value}deg)`)
const turned = computed(() => Math.abs(rotation.value / 90) % 2 === 1)
const limits = computed(() =>
  turned.value ? { maxWidth: `${box.value.h}px`, maxHeight: `${box.value.w}px` } : {},
)
const cursor = computed(() => (scale.value > 1 ? (dragging.value ? "grabbing" : "grab") : "zoom-in"))
</script>

<template>
  <div class="image">
    <PreviewToolbar>
      <SiblingNav :nav="nav" />
      <span class="spacer" />
      <span v-if="natural.w" class="hint">{{ natural.w }} × {{ natural.h }}</span>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomOut')" :disabled="scale <= 1" @click="zoomTo(scale / 1.5)">
        <FluentSvgIcon :svg="previewIcons.zoomOut" :size="18" />
      </FluentButton>
      <span class="hint zoom">{{ Math.round(scale * 100) }}%</span>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomIn')" :disabled="scale >= MAX_SCALE" @click="zoomTo(scale * 1.5)">
        <FluentSvgIcon :svg="previewIcons.zoomIn" :size="18" />
      </FluentButton>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.rotateLeft')" @click="rotate(-90)">
        <FluentSvgIcon :svg="previewIcons.arrowRotateLeft" :size="18" />
      </FluentButton>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.rotateRight')" @click="rotate(90)">
        <FluentSvgIcon :svg="previewIcons.arrowRotateRight" :size="18" />
      </FluentButton>
      <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.fit')" :disabled="scale === 1 && rotation === 0" @click="rotation = 0; reset()">
        <FluentSvgIcon :svg="previewIcons.arrowReset" :size="18" />
      </FluentButton>
      <FluentButton tone="subtle" @click="openOriginal">
        <FluentSvgIcon :svg="previewIcons.open" :size="18" />
        {{ t("preview.image.original") }}
      </FluentButton>
    </PreviewToolbar>

    <PreviewNotice
      v-if="status === 'error'"
      tone="error"
      :title="t('preview.image.errorTitle')"
      :detail="t('preview.image.errorDetail')"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <div
      v-show="status !== 'error'"
      ref="stage"
      class="stage"
      :style="{ cursor }"
      @wheel.prevent="onWheel"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <img
        ref="image"
        :key="src"
        class="stage__img"
        :class="{ 'stage__img--animate': !dragging }"
        :src="src"
        :alt="file.name"
        :style="{ transform, ...limits }"
        draggable="false"
        @load="onLoad"
        @error="onError"
      />
      <div v-if="status === 'loading'" class="stage__loading">{{ t("preview.image.loading") }}</div>
    </div>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  height: clamp(260px, 72dvh, 880px);
  overflow: hidden;
  touch-action: none;
  user-select: none;
  background: var(--fluent-control-alt);
}
.stage__img {
  position: absolute;
  left: 50%;
  top: 50%;
  max-width: 100%;
  max-height: 100%;
  pointer-events: none;
}
.stage__img--animate {
  transition: transform var(--fluent-fast) var(--fluent-ease);
}
.stage__loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--fluent-muted);
}
.zoom {
  min-width: 3.5em;
  text-align: center;
}
</style>
