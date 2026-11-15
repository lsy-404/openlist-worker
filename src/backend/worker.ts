import app from "./index"
import { OpenListDB } from "./durable-objects/OpenListDB"
import { setEnvCtx } from "./internal/model/db"
import { syncTick } from "./internal/sync/engine"

// Durable Object 类（DB_DRIVER=do 时使用），需在 wrangler.toml 声明
// new_sqlite_classes = ["OpenListDB"] 与对应的 binding。
export { OpenListDB }

export default {
  fetch: app.fetch,
  // Awaited rather than handed to waitUntil, so the run gets the full Cron Trigger wall-clock window
  async scheduled(_controller: unknown, env: any) {
    setEnvCtx(env)
    await syncTick(env)
  },
}
