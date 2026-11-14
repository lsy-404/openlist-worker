<script setup lang="ts">
import { siteTitle } from "@/stores/session"

const year = new Date().getFullYear()
</script>

<template>
  <footer class="footer">© {{ year }} {{ siteTitle }}</footer>
</template>

<style scoped>
.footer {
  margin-top: auto;
  padding: 16px max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
  color: var(--fluent-muted);
  font-size: 0.85rem;
  text-align: center;
}
</style>
