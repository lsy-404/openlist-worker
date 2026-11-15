<script setup lang="ts" generic="T extends object">
import { useI18n } from "vue-i18n"
import { FluentButton, FluentProgressBar } from "@platform-kit/fluent/vue"
import StateMessage from "@/components/StateMessage.vue"
import { icons } from "@/utils/icons"

export interface Column {
  key: string
  label: string
}

const props = withDefaults(
  defineProps<{
    columns: Column[]
    rows: T[]
    /** Property holding a unique id. */
    rowKey?: string
    loading?: boolean
    error?: string | null
    emptyTitle?: string
    emptyDetail?: string
  }>(),
  { rowKey: "id", loading: false, error: null, emptyTitle: undefined, emptyDetail: undefined },
)
defineEmits<{ retry: [] }>()
defineSlots<{
  [cell: `cell-${string}`]: (props: { row: T }) => unknown
  actions?: (props: { row: T }) => unknown
  empty?: () => unknown
}>()

const { t } = useI18n()

const cell = (row: T, key: string) => String((row as Record<string, unknown>)[key] ?? "")
const keyOf = (row: T) => String((row as Record<string, unknown>)[props.rowKey])
</script>

<template>
  <div class="table" :aria-busy="loading">
    <FluentProgressBar v-if="loading && rows.length" class="table__bar" indeterminate :label="t('common.loading')" />

    <div v-if="loading && !rows.length && !error" class="table__skeleton" aria-hidden="true">
      <span v-for="n in 4" :key="n" class="table__skeleton-row" />
    </div>

    <StateMessage v-else-if="error" :icon="icons.warning" :title="t('admin.table.error')" :detail="error">
      <FluentButton tone="primary" @click="$emit('retry')">{{ t("common.retry") }}</FluentButton>
    </StateMessage>

    <StateMessage v-else-if="!rows.length" :icon="icons.folderOpen" :title="emptyTitle ?? t('admin.table.empty')" :detail="emptyDetail">
      <slot name="empty" />
    </StateMessage>

    <table v-else class="table__grid">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
          <th v-if="$slots.actions" scope="col"><span class="sr-only">{{ t("admin.table.actions") }}</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="keyOf(row)">
          <td v-for="column in columns" :key="column.key" :data-label="column.label">
            <slot :name="`cell-${column.key}`" :row="row">{{ cell(row, column.key) }}</slot>
          </td>
          <td v-if="$slots.actions" class="table__actions"><slot name="actions" :row="row" /></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.table__grid {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  padding: 10px 12px;
  text-align: start;
  vertical-align: middle;
  border-bottom: 1px solid var(--fluent-border);
  overflow-wrap: anywhere;
}
th {
  color: var(--fluent-muted);
  font-size: 0.8rem;
  font-weight: 600;
}
tbody tr {
  transition: var(--motion-fill);
}
tbody tr:hover {
  background: var(--fluent-control-hover);
}
.table__actions {
  width: 1%;
  white-space: nowrap;
  text-align: end;
}
.table__skeleton {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.table__skeleton-row {
  height: 40px;
  border-radius: var(--fluent-radius);
  background: var(--fluent-control-hover);
  animation: table-pulse calc(1200ms * var(--fluent-motion-scale)) linear infinite;
}
@keyframes table-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
@media (prefers-reduced-motion: reduce) {
  .table__skeleton-row {
    animation: none;
  }
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
@media (max-width: 640px) {
  thead {
    display: none;
  }
  table,
  tbody,
  tr,
  td {
    display: block;
  }
  tr {
    margin-bottom: 8px;
    padding: 4px 0;
    border: 1px solid var(--fluent-border);
    border-radius: var(--fluent-radius);
  }
  td {
    display: flex;
    gap: 12px;
    justify-content: space-between;
    border-bottom: none;
    padding: 6px 12px;
  }
  td::before {
    content: attr(data-label);
    flex: none;
    color: var(--fluent-muted);
  }
  td:first-child {
    font-weight: 600;
  }
  td:first-child::before {
    display: none;
  }
  .table__actions {
    width: auto;
    justify-content: flex-end;
  }
}
</style>
