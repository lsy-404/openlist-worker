<template>
  <div class="toolbar"><slot /></div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--fluent-border);
}
.toolbar :deep(.spacer) {
  flex: 1;
}
.toolbar :deep(.hint) {
  color: var(--fluent-muted);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}
</style>
