import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

const backend = process.env.WEB_BACKEND || "https://icloud.leisiyu.dev"
const proxy = { target: backend, changeOrigin: true, secure: true }

export default defineConfig({
  base: "/",
  plugins: [vue()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
  },
  server: {
    proxy: { "/api": proxy, "/d": proxy, "/p": proxy },
  },
})
