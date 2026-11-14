import "@platform-kit/fluent/style.css"
import { createApp } from "vue"
import App from "./App.vue"
import { bindLocale, i18n } from "./i18n"
import { router } from "./router"
import "./actions"
import "./previews"
import { bindThemeToDocument } from "./stores/prefs"
import { loadSession } from "./stores/session"

bindThemeToDocument()
bindLocale()
void loadSession()
createApp(App).use(router).use(i18n).mount("#app")
