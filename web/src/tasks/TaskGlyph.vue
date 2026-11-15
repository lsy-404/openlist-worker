<script setup lang="ts">
import { computed } from "vue"

const props = withDefaults(defineProps<{ svg: string; size?: number }>(), { size: 16 })

// A mask keeps the glyph in currentColor, so state colours need no theme-dependent inversion
const style = computed(() => {
  const url = `url("data:image/svg+xml,${encodeURIComponent(props.svg)}")`
  return { width: `${props.size}px`, height: `${props.size}px`, maskImage: url, WebkitMaskImage: url }
})
</script>

<template>
  <span class="glyph" :style="style" aria-hidden="true" />
</template>

<style scoped>
.glyph {
  display: inline-block;
  flex: none;
  background-color: currentColor;
  mask-repeat: no-repeat;
  mask-position: center;
  mask-size: contain;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-position: center;
  -webkit-mask-size: contain;
}
</style>
