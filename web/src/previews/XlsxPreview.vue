<script setup lang="ts">
import { useI18n } from "vue-i18n"
import { computed, ref, watch } from "vue"
import { FluentSegmented, FluentSelect } from "@platform-kit/fluent/vue"
import { formatDate } from "@/utils/format"
import BufferGate from "./BufferGate.vue"
import PreviewToolbar from "./PreviewToolbar.vue"
import type { PreviewProps } from "./registry"
import { useFileBuffer } from "./useFileBuffer"

const MAX_ROWS = 2000
const MAX_COLS = 100

type Cell = string | number | boolean | Date | null | undefined
interface Sheet {
  sheet: string
  data: Cell[][]
}

const { t } = useI18n()
const props = defineProps<PreviewProps>()
const { status, buffer, error, load } = useFileBuffer(() => ({ url: props.downloadUrl, size: props.file.size }))

const sheets = ref<Sheet[]>([])
const active = ref("0")
const failed = ref("")

watch(buffer, async (data) => {
  sheets.value = []
  failed.value = ""
  active.value = "0"
  if (!data) return
  try {
    const { default: readExcel } = await import("read-excel-file/browser")
    sheets.value = (await readExcel(new Blob([data]))) as unknown as Sheet[]
  } catch (err) {
    failed.value = err instanceof Error ? err.message : String(err)
  }
})

const options = computed(() => sheets.value.map((s, i) => ({ value: String(i), label: s.sheet })))
const sheet = computed(() => sheets.value[Number(active.value)])
const rows = computed(() => sheet.value?.data.slice(0, MAX_ROWS) ?? [])
const width = computed(() => Math.min(MAX_COLS, Math.max(0, ...rows.value.map((r) => r.length))))
const truncated = computed(() => (sheet.value?.data.length ?? 0) > MAX_ROWS)

function columnName(index: number): string {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}

function show(cell: Cell): string {
  if (cell === null || cell === undefined) return ""
  return cell instanceof Date ? formatDate(cell.toISOString()) : String(cell)
}
</script>

<template>
  <div>
    <BufferGate
      v-if="status !== 'ready' || failed"
      :status="status"
      :error="error"
      :failed="failed"
      :size="file.size"
      :download-url="downloadUrl"
      :filename="file.name"
      @load="load"
    />
    <template v-else-if="sheet">
      <PreviewToolbar>
        <FluentSelect v-if="options.length > 4" v-model="active" :options="options" :label="t('preview.office.sheet')" />
        <FluentSegmented v-else-if="options.length > 1" :model-value="active" :options="options" :label="t('preview.office.sheet')" @update:model-value="active = String($event)" />
        <span class="spacer" />
        <span v-if="truncated" class="hint">{{ t("preview.office.truncated", { rows: MAX_ROWS }) }}</span>
      </PreviewToolbar>
      <div class="sheet">
        <table>
          <thead>
            <tr>
              <th class="corner" />
              <th v-for="c in width" :key="c">{{ columnName(c - 1) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, r) in rows" :key="r">
              <th class="row">{{ r + 1 }}</th>
              <td v-for="c in width" :key="c" :class="{ num: typeof row[c - 1] === 'number' }">{{ show(row[c - 1]) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style scoped>
.sheet {
  max-height: 72dvh;
  overflow: auto;
}
table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 0.85rem;
}
th,
td {
  padding: 4px 10px;
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border-right: 1px solid var(--fluent-border);
  border-bottom: 1px solid var(--fluent-border);
}
thead th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--fluent-control);
  color: var(--fluent-muted);
  font-weight: 500;
}
th.row,
th.corner {
  position: sticky;
  left: 0;
  background: var(--fluent-control);
  color: var(--fluent-muted);
  font-weight: 500;
  text-align: center;
}
th.corner {
  z-index: 2;
}
td.num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}
</style>
