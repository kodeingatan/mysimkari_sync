# AGENTS.md — MySimkari Sync

## Project overview

Windows-only Electron desktop app (Vue 3 + TypeScript + Vite). Syncs employee performance documents to the MySimkari portal (`mysimkari.kejaksaan.go.id`). No CI, no README.

## Commands

| Command | What happens |
|---|---|
| `npm run dev` | Runs `predev` (downloads Ghostscript if missing), then `vite` with `vite-plugin-electron` |
| `npm run build` | Runs `prebuild` (Ghostscript check), `vue-tsc --noEmit`, `vite build`, `electron-builder` |

**No test runner, linter, or formatter is configured.** The only quality gate is TypeScript strict mode (`vue-tsc --noEmit`) during build. Verify changes with:

```
npm run build
```

## Critical constraints

- **Windows-only.** DOC/XLS/PPT to PDF conversion uses PowerShell COM automation (`New-Object -ComObject Word.Application`). Will not work on macOS/Linux.
- **Ghostscript required.** `scripts/setup-binaries.js` auto-downloads `gswin64c.exe` to `bin/gs/`. If the binary is missing, `dev` and `build` will fail at the pre-script stage. When Ghostscript compression fails, the app falls back to Word COM automation.
- **File upload limit: 500KB.** Files are converted to PDF then compressed in stages (ebook quality, then screen quality) if over limit.
- **`contextIsolation: false`.** The preload script exposes `ipcRenderer` directly on `window` without a context bridge. Frontend code uses `// @ts-ignore` to suppress type errors on IPC calls — this is intentional, not a bug.
- **`better-sqlite3` is a native module.** It is externalized in `vite.config.ts` rollup options. Do not bundle it.
- **No `.env` file or env loading.** Secrets (session cookies, user IDs, AI API keys) are stored in SQLite `settings` table.

## Architecture

- `electron/main.ts` — Electron main process: window, IPC handlers, SQLite init, MySimkari API integration
- `electron/preload.ts` — Exposes `window.ipcRenderer` directly (no context bridge)
- `electron/parser.ts` — Document parsing dispatcher; delegates to sub-parsers in `electron/parser/` (PDF via pdf-parse, DOCX via mammoth, XLSX via xlsx, PPTX via officeparser, images via tesseract.js OCR)
- `src/App.vue` — Root component: sidebar + main content + sync form + history
- `src/components/` — Vue 3 `<script setup>` components (layout + ui)

**IPC pattern:** `ipcMain.handle()` in main process, `window.ipcRenderer.invoke()` in renderer. Key channels: `select-folder`, `read-folder`, `parse-file`, `sync-data`, `login-mysimkari`, `get-form-options`.

**Database:** SQLite via `better-sqlite3`. Tables: `documents` (file data + status), `settings` (key-value). DB file is `mysimkari.sqlite` in userData directory (gitignored).

## Conventions

- Path alias: `@/` maps to `src/` (tsconfig + vite)
- Vue 3 Composition API with `<script setup>` — no Options API
- Tailwind CSS 3 with custom tokens in `tailwind.config.mjs` (`primary`, `success`, `warning`, `error`, `surface`, `background`)
- TypeScript strict mode: `noUnusedLocals`, `noUnusedParameters`
- Bilingual docs in `doc/` (English + Indonesian) — useful reference if you need to understand data flow

## Gotchas

- The `bin/` directory is gitignored. Ghostscript is downloaded on first run — don't expect it in a fresh clone.
- `dist/` and `dist-electron/` are build artifacts (gitignored).
- AI generation supports Gemini and OpenAI-compatible providers. Settings and API keys are stored in SQLite.
- The app scrapes MySimkari HTML with cheerio/regex (e.g., CSRF token extraction, form options). Portal HTML structure changes will break this.
