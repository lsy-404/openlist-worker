<script setup lang="ts">
import { useI18n } from "vue-i18n"
import dismiss from "@fluentui/svg-icons/icons/dismiss_24_regular.svg?raw"
import filter from "@fluentui/svg-icons/icons/filter_24_regular.svg?raw"
import { FluentSvgIcon } from "@platform-kit/fluent/vue"
import { folderFilter } from "./state"

const { t } = useI18n()
</script>

<template>
  <label class="filter">
    <FluentSvgIcon :svg="filter" :size="16" />
    <input
      v-model="folderFilter.text"
      class="filter__input"
      type="text"
      :placeholder="t('search.filter.placeholder')"
      :aria-label="t('search.filter.label')"
      autocomplete="off"
      spellcheck="false"
      @keydown.esc="folderFilter.text = ''"
    />
    <button v-if="folderFilter.text" class="filter__clear" type="button" :aria-label="t('search.filter.clear')" @click="folderFilter.text = ''">
      <FluentSvgIcon :svg="dismiss" :size="14" />
    </button>
  </label>
</template>

<style scoped>
.filter {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 8px;
  box-sizing: border-box;
  color: var(--fluent-muted);
  background: var(--fluent-control);
  border: 1px solid var(--fluent-border);
  border-radius: var(--fluent-radius);
}
.filter:focus-within {
  outline: 2px solid var(--fluent-focus-outer);
  outline-offset: 1px;
}
.filter__input {
  width: 150px;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--fluent-text);
  font: inherit;
}
.filter__clear {
  display: inline-flex;
  padding: 2px;
  border: 0;
  border-radius: var(--fluent-radius);
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition: var(--motion-fill);
}
.filter__clear:hover {
  background: var(--fluent-control-hover);
}
@media (max-width: 640px) {
  .filter {
    flex: 1 1 100%;
  }
  .filter__input {
    width: 100%;
  }
}
</style>
