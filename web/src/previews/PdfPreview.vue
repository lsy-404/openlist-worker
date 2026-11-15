<script setup lang="ts">
import "pdfjs-dist/web/pdf_viewer.css"
import { useI18n } from "vue-i18n"
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue"
import { FluentButton, FluentSvgIcon } from "@platform-kit/fluent/vue"
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist"
import { fetchBuffer, fetchErrorMessage } from "./fetch"
import PreviewNotice from "./PreviewNotice.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import { previewIcons } from "./icons"
import { documentOptions, loadPdfjs } from "./pdfjs"
import type { PreviewProps } from "./registry"

const { t } = useI18n()
const props = defineProps<PreviewProps>()

const status = ref<"loading" | "ready" | "error" | "locked">("loading")
const error = ref("")
const pages = ref(0)
const current = ref(1)
const zoom = ref(1)
const scroller = ref<HTMLElement>()
const holder = ref<HTMLElement>()
const doc = shallowRef<PDFDocumentProxy | null>(null)
// Pages are laid out at zoom times the width that fits the scroller
const baseWidth = ref(0)
const aspect = ref(1.414)
const fitScale = ref(1)

const percent = computed(() => Math.round(zoom.value * 100))

interface Slot {
  el: HTMLElement
  task: RenderTask | null
  token: number
}
const slots = new Map<number, Slot>()
let observer: IntersectionObserver | null = null
let loadToken = 0

function cssWidth() {
  return baseWidth.value * fitScale.value * zoom.value
}

async function open() {
  const token = ++loadToken
  status.value = "loading"
  teardown()
  try {
    const [pdfjs, data] = await Promise.all([loadPdfjs(), fetchBuffer(props.downloadUrl)])
    const opened = await pdfjs.getDocument({ data: new Uint8Array(data), ...documentOptions }).promise
    if (token !== loadToken) return void opened.loadingTask.destroy()
    doc.value = opened
    const first = await opened.getPage(1)
    const view = first.getViewport({ scale: 1 })
    baseWidth.value = view.width
    aspect.value = view.height / view.width
    pages.value = opened.numPages
    current.value = 1
    zoom.value = 1
    status.value = "ready"
    await nextTick()
    fitScale.value = Math.max(0.2, ((scroller.value?.clientWidth ?? view.width) - 24) / view.width)
    build()
  } catch (err) {
    if (token !== loadToken) return
    const name = (err as { name?: string })?.name
    if (name === "PasswordException") {
      status.value = "locked"
    } else {
      error.value = name === "InvalidPDFException" ? t("preview.pdf.invalid") : fetchErrorMessage(err)
      status.value = "error"
    }
  }
}

function teardown() {
  observer?.disconnect()
  observer = null
  for (const slot of slots.values()) slot.task?.cancel()
  slots.clear()
  const old = doc.value
  doc.value = null
  void old?.loadingTask.destroy()
}

function build() {
  const root = holder.value
  if (!root || !doc.value) return
  observer?.disconnect()
  for (const slot of slots.values()) slot.task?.cancel()
  slots.clear()
  root.replaceChildren()
  const width = cssWidth()
  observer = new IntersectionObserver(onIntersect, { root: scroller.value, rootMargin: "800px 0px" })
  for (let n = 1; n <= pages.value; n++) {
    const el = document.createElement("div")
    el.className = "pdf-page"
    el.dataset.page = String(n)
    el.style.width = `${width}px`
    el.style.height = `${width * aspect.value}px`
    root.appendChild(el)
    slots.set(n, { el, task: null, token: 0 })
    observer.observe(el)
  }
}

function onIntersect(entries: IntersectionObserverEntry[]) {
  for (const entry of entries) {
    const n = Number((entry.target as HTMLElement).dataset.page)
    if (entry.isIntersecting) void render(n)
    else release(n)
  }
}

function release(n: number) {
  const slot = slots.get(n)
  if (!slot) return
  slot.task?.cancel()
  slot.task = null
  slot.token++
  slot.el.replaceChildren()
}

async function render(n: number) {
  const slot = slots.get(n)
  const pdf = doc.value
  if (!slot || !pdf || slot.el.childElementCount) return
  const token = ++slot.token
  try {
    const page = await pdf.getPage(n)
    if (token !== slot.token) return
    const viewport = page.getViewport({ scale: cssWidth() / page.getViewport({ scale: 1 }).width })
    slot.el.style.width = `${viewport.width}px`
    slot.el.style.height = `${viewport.height}px`
    const ratio = window.devicePixelRatio || 1
    const canvas = document.createElement("canvas")
    canvas.width = Math.floor(viewport.width * ratio)
    canvas.height = Math.floor(viewport.height * ratio)
    canvas.style.width = `${viewport.width}px`
    canvas.style.height = `${viewport.height}px`
    const text = document.createElement("div")
    text.className = "textLayer"
    slot.el.append(canvas, text)
    const task = page.render({
      canvas,
      viewport,
      transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
    })
    slot.task = task
    await task.promise
    const { TextLayer } = await loadPdfjs()
    await new TextLayer({ textContentSource: page.streamTextContent(), container: text, viewport }).render()
  } catch (err) {
    // A cancelled render is expected when the page scrolls away or the zoom changes
    if ((err as { name?: string })?.name !== "RenderingCancelledException") slot.el.replaceChildren()
  }
}

function setZoom(next: number) {
  zoom.value = Math.min(4, Math.max(0.25, next))
  build()
  void nextTick(() => scrollTo(current.value))
}

function scrollTo(n: number) {
  const page = Math.min(pages.value, Math.max(1, n))
  slots.get(page)?.el.scrollIntoView({ block: "start" })
  current.value = page
}

function onScroll() {
  const top = scroller.value?.getBoundingClientRect().top ?? 0
  const limit = (scroller.value?.clientHeight ?? 0) / 3
  let best = 1
  for (const [n, slot] of slots) {
    if (slot.el.getBoundingClientRect().top - top <= limit) best = n
    else break
  }
  current.value = best
}

function onPageInput(e: Event) {
  const value = Number((e.target as HTMLInputElement).value)
  if (Number.isFinite(value)) scrollTo(Math.round(value))
}

function openOriginal() {
  window.open(props.downloadUrl, "_blank", "noopener")
}

watch(() => props.downloadUrl, () => void open(), { immediate: true })
onBeforeUnmount(() => {
  loadToken++
  teardown()
})
</script>

<template>
  <div class="pdf">
    <PreviewNotice v-if="status === 'loading'" tone="loading" :title="t('preview.pdf.loading')" />
    <PreviewNotice
      v-else-if="status === 'locked'"
      tone="info"
      :title="t('preview.pdf.lockedTitle')"
      :detail="t('preview.pdf.lockedDetail')"
      :download-url="downloadUrl"
      :filename="file.name"
    />
    <PreviewNotice
      v-else-if="status === 'error'"
      tone="error"
      :title="t('preview.pdf.errorTitle')"
      :detail="error"
      :download-url="downloadUrl"
      :filename="file.name"
    >
      <FluentButton @click="open">{{ t("common.retry") }}</FluentButton>
    </PreviewNotice>
    <template v-else>
      <PreviewToolbar>
        <label class="pager">
          <input class="pager__input" type="number" min="1" :max="pages" :value="current" :aria-label="t('preview.pdf.page')" @change="onPageInput" />
          <span class="hint">/ {{ pages }}</span>
        </label>
        <span class="spacer" />
        <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomOut')" :disabled="zoom <= 0.25" @click="setZoom(zoom / 1.25)">
          <FluentSvgIcon :svg="previewIcons.zoomOut" :size="18" />
        </FluentButton>
        <span class="hint zoom">{{ percent }}%</span>
        <FluentButton tone="subtle" icon-only :aria-label="t('preview.image.zoomIn')" :disabled="zoom >= 4" @click="setZoom(zoom * 1.25)">
          <FluentSvgIcon :svg="previewIcons.zoomIn" :size="18" />
        </FluentButton>
        <FluentButton tone="subtle" icon-only :aria-label="t('preview.pdf.fitWidth')" :disabled="zoom === 1" @click="setZoom(1)">
          <FluentSvgIcon :svg="previewIcons.arrowReset" :size="18" />
        </FluentButton>
        <FluentButton tone="subtle" @click="openOriginal">
          <FluentSvgIcon :svg="previewIcons.open" :size="18" />
          {{ t("preview.image.original") }}
        </FluentButton>
      </PreviewToolbar>
      <div ref="scroller" class="pdf__scroller" tabindex="0" @scroll.passive="onScroll">
        <div ref="holder" class="pdf__pages" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.pdf__scroller {
  height: clamp(320px, 78dvh, 960px);
  overflow: auto;
  background: var(--fluent-control-alt);
}
.pdf__pages {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  min-width: max-content;
  padding: 12px;
}
.pdf__pages :deep(.pdf-page) {
  position: relative;
  flex: none;
  background: #fff;
  box-shadow: 0 1px 6px rgb(0 0 0 / 25%);
  --scale-factor: 1;
}
.pdf__pages :deep(.pdf-page canvas) {
  display: block;
}
.pager {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pager__input {
  width: 4em;
  padding: 4px 6px;
  color: var(--fluent-text);
  background: var(--fluent-control);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.zoom {
  min-width: 3.5em;
  text-align: center;
}
</style>
