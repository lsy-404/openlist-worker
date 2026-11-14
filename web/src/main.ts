import "@platform-kit/fluent/style.css"
import { createApp } from "vue"
import App from "./App.vue"
import { router } from "./router"
import "./actions"
import "./previews"
import { bindThemeToDocument } from "./stores/prefs"
import { loadSession } from "./stores/session"

bindThemeToDocument()
void loadSession()
createApp(App).use(router).mount("#app")
