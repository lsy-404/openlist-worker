import { fileURLToPath, URL } from "node:url"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"
import { viteStaticCopy } from "vite-plugin-static-copy"

const backend = process.env.WEB_BACKEND || "https://icloud.leisiyu.dev"
const proxy = { target: backend, changeOrigin: true, secure: true }

export default defineConfig({
  base: "/",
  plugins: [
    vue(),
    viteStaticCopy({
      targets: ["cmaps", "standard_fonts", "wasm", "iccs"].map((dir) => ({
        src: `node_modules/pdfjs-dist/${dir}/*`,
        dest: `pdfjs/${dir}`,
      })),
    }),
  ],
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
