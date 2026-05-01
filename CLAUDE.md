# Ansura — Claude Code Context

## What this is

A Chrome extension (Manifest V3, TypeScript) that lets the user click the toolbar icon, select any HTML element on a page, and get the correct answer via the Gemini API displayed in a subtle overlay.

## Build

```sh
pnpm build        # webpack → dist/
```

Load `dist/` as an unpacked extension in `chrome://extensions`. Reload the extension after each build.

## Key conventions

- **pnpm only** — never npm or npx for package management
- **Version bump on every change** — update `version` in both `manifest.json` and `package.json` after every code change. Use semver: patch for fixes, minor for features. Always tell the user the new version.
- **TECHNICAL_DOCS.md** is the authoritative spec — all architecture decisions should align with it

## Architecture

```
src/
  background/service-worker.ts   # Gemini API calls, AbortController, retry on 429, badge
  content/
    content.ts                   # Message listener; coordinates selector ↔ overlay
    selector.ts                  # activate(onSelected?)/deactivate(); hover + click + Esc
    overlay.ts                   # Shadow DOM overlay: showLoading/showAnswer/showError/showStatus/hide
  options/
    options.html + options.ts    # API key, model, fallback models, Test models button
  types/index.ts                 # MessageToContent / MessageToBackground discriminated unions
```

Two webpack configs in `webpack.config.js`:

- `target: 'webworker'` → `background/service-worker.js`
- `target: 'web'` → `content/content.js`, `options/options.js`

## Key behaviours

- **No popup** — `chrome.action.onClicked` fires the service worker; `default_popup` must NOT be set
- **Selection mode state** — tracked in `chrome.storage.session` (keyed by tab ID); service worker has no persistent memory between events
- **Cancel during loading** — any click or keypress while "Thinking…" shows fires `CANCEL_REQUEST` to the service worker, which calls `AbortController.abort()`. The `abortSignal` is passed inside `config` to `ai.models.generateContent()`
- **429 retry** — service worker loops through `[...new Set([primaryModel, ...fallbackModels])]`; duplicates are skipped. Sends `SHOW_STATUS` to update overlay text between attempts
- **Shadow DOM overlay** — isolated from host page CSS; `mode: 'closed'`
- **Multi-answer** — Gemini is prompted to put each answer on its own line; overlay splits on `\n` and renders a `<ul>` if multiple

## Message protocol

```
SW → Content:  TOGGLE_SELECTION_MODE | SHOW_ANSWER { answer } | SHOW_ERROR { message } | SHOW_STATUS { message }
Content → SW:  ELEMENT_SELECTED { html } | SELECTION_CANCELLED | CANCEL_REQUEST
```

## Gemini SDK

Package: `@google/genai` (not the deprecated `@google/generative-ai`).

- `abortSignal` goes inside `config`, not at the top level of `generateContent` params
- 429 errors are caught by checking `'status' in err && err.status === 429`

## Options storage keys

`chrome.storage.sync`: `apiKey`, `model`, `fallbackModels` (comma-separated string)
