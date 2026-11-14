# OpenList Web

Vue 3 + TypeScript + Vite frontend for the Worker port, built on `@platform-kit/fluent`.

## Develop

```sh
pnpm --dir web install --ignore-workspace   # first time; web/ has its own lockfile
pnpm web:dev                                # from the repo root, or `pnpm --dir web dev`
```

The dev server proxies `/api`, `/d` and `/p` to `https://icloud.leisiyu.dev`. Point it at another backend with `WEB_BACKEND=http://localhost:8787 pnpm web:dev`.

## Build

```sh
pnpm web:build
```

Type-checks with `vue-tsc` and writes the bundle to the repo-root `dist/`, which the Worker serves with SPA fallback. Keep the plain `<head>` tag in `index.html`; the Worker injects a script right after it. The Worker's CSP forbids inline scripts, so do not add any.

## Structure

```
web/src/
  api/        typed client: request/ApiError/token (http.ts), endpoints (index.ts), response types
  stores/     session (settings, user, login return path), prefs (theme, view, sort), passwords, toast
  views/      BrowseView (route target), FolderView, FileView, LoginView, useBrowse (data loading)
  components/ AppHeader, Breadcrumb, EntryList, ActionBar, MenuButton, MarkdownView, PasswordDialog, ...
  previews/   preview registry and fallback
  actions/    action registry and built-in actions
  utils/      path, format, icons, links, markdown helpers
```

URL space: the page path is the folder/file path. `/@login`, `/api`, `/d`, `/p`, `/dav`, `/s3` and `/assets` are reserved. Downloads use the `raw_url` returned by `fs/get`; links built from a folder listing are `/d` + base path + path + `?sign=`.

## Add a preview

Create a component that takes `PreviewProps` (`file`, `path`, `downloadUrl`) and register it from `src/previews/index.ts`:

```ts
import { registerPreview } from "./registry"
import ImagePreview from "./ImagePreview.vue"

registerPreview({
  name: "image",
  match: (file) => file.type === 5,
  component: ImagePreview,
})
```

The file view uses the first matching preview (lower `order` first) and falls back to `FallbackPreview.vue`.

## Add an action

Register it from a module imported by `src/actions/index.ts`:

```ts
import { registerAction } from "@/actions"
import { icons } from "@/utils/icons"

registerAction({
  id: "open-new-tab",
  label: "新标签页打开",
  icon: icons.link,
  order: 30,
  when: (ctx) => ctx.kind === "file",
  run: (ctx) => window.open(ctx.downloadUrl!, "_blank"),
})
```

Actions render in the folder and file toolbars (`ctx.surface === "toolbar"`) and in each entry's menu (`"context"`). `ActionContext` provides the target `entry`, `path`, `kind`, `downloadUrl`, `notify`, `refresh` and `navigate`, plus `dir` (the containing folder), `selection` (entries of the selection bar, surface `"selection"`) and `caps` (which file operations the user may perform). File operations and upload live in `actions/fileops.ts`; `caps` is derived in `actions/permissions.ts` from `/api/me` and the listing's `write` flag.

## Header search

`AppHeader.vue` exposes a `search` slot inside `[data-slot="header-search"]`; put a future search box there.
