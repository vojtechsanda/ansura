# Ansura – Technical Documentation

> Chrome Extension · TypeScript · Manifest V3  
> Purpose: Select a quiz/question HTML element on any page, send it to the Gemini API, and display the correct answer subtly on screen.

---

## 1. Project Overview

**Ansura** is a Chrome extension that allows the user to:

1. Click the extension toolbar icon to enter "selection mode."
2. Hover over any HTML element on the page — the hovered element gets a visible outline/glow highlight.
3. Click the element → highlight immediately disappears, selection mode exits, and the element's HTML is sent to Gemini.
4. Receive the correct answer displayed in a subtle, fixed overlay at the bottom-right corner of the screen.
5. The overlay stays visible until the user clicks anywhere or presses any key to dismiss it.
6. At any point during selection mode, pressing **Esc** cancels selection mode with no action taken.

The extension is written entirely in **TypeScript**, compiled to plain JavaScript, and targets **Manifest V3**.

---

## 2. User-Facing Behaviour (Requirements)

| Behaviour             | Decision                                                                        |
| --------------------- | ------------------------------------------------------------------------------- |
| Trigger               | Click the toolbar icon — no popup, fires `chrome.action.onClicked` directly     |
| Cancel selection mode | Press **Esc** at any time                                                       |
| Selection UX          | Hover shows outline/glow; click **immediately sends** and removes the highlight |
| Highlight lifetime    | Shown on hover, **removed on click** before sending                             |
| Gemini model          | **TBD** — stored in options, configurable                                       |
| API key storage       | **TBD** — stored in options, configurable                                       |
| Overlay position      | Fixed **bottom-right** corner                                                   |
| Overlay content       | **Correct answer only** — no explanation, no confidence score                   |
| Overlay dismissal     | Stays until user **clicks anywhere** or **presses any key**                     |
| Overlay visibility    | Subtle — small, semi-transparent, unobtrusive                                   |

---

## 3. Architecture

```
ansura/
├── manifest.json
├── src/
│   ├── background/
│   │   └── service-worker.ts     # MV3 service worker — Gemini API calls live here
│   ├── content/
│   │   ├── content.ts            # Main content script entry point
│   │   ├── selector.ts           # Hover highlight + click + Esc cancel logic
│   │   └── overlay.ts            # Answer overlay UI + dismiss logic
│   ├── options/
│   │   ├── options.html          # Settings page: API key + model name
│   │   └── options.ts
│   └── types/
│       └── index.ts              # Shared TypeScript interfaces & message types
├── public/
│   └── icons/                    # 16px, 48px, 128px PNG icons
├── tsconfig.json
├── webpack.config.js
└── package.json
```

> **No popup.** There is no `popup.html`. The toolbar icon fires `chrome.action.onClicked` in the service worker, which messages the content script to toggle selection mode. `default_popup` must NOT be set in `manifest.json` — if it is set, `onClicked` will never fire.

---

## 4. Component Responsibilities

### 4.1 Service Worker (`background/service-worker.ts`)

- Listens for `chrome.action.onClicked` → sends `TOGGLE_SELECTION_MODE` to the active tab's content script.
- Listens for `ELEMENT_SELECTED` messages from the content script (containing `outerHTML`).
- Reads API key and model name from `chrome.storage.sync`.
- Calls the Gemini API using `@google/genai` (see §6). All network calls go here — content scripts cannot reliably make cross-origin requests on CSP-restricted pages.
- Parses the response and sends `SHOW_ANSWER` back to the content script.
- Sends `SHOW_ERROR` on failure (network error, bad API key, parse failure).
- Uses `chrome.action.setBadgeText` to show `"ON"` / `""` to reflect selection mode state visually on the icon.

### 4.2 Content Script Entry Point (`content/content.ts`)

- Injected into all pages at `document_idle`.
- Listens for messages from the service worker:
  - `TOGGLE_SELECTION_MODE` → calls `selector.activate()` or `selector.deactivate()` depending on current state.
  - `SHOW_ANSWER` → calls `overlay.showAnswer(payload)`.
  - `SHOW_ERROR` → calls `overlay.showError(message)`.
- Tracks a local `isSelectionModeActive: boolean` flag.

### 4.3 Selector (`content/selector.ts`)

Exports two functions: `activate()` and `deactivate()`.

**`activate()`:**

- Sets `document.body.style.cursor = 'crosshair'`.
- Adds `mouseover` listener:
  - Removes `.ansura-hover` from any previously highlighted element.
  - Adds `.ansura-hover` to the currently hovered element.
- Adds `click` listener (capturing phase, `useCapture: true`):
  - Calls `event.preventDefault()` and `event.stopPropagation()`.
  - **Immediately removes `.ansura-hover`** from the clicked element before doing anything else.
  - Calls `deactivate()` to clean up all listeners and cursor.
  - Sends `ELEMENT_SELECTED` message to the service worker with `element.outerHTML`.
- Adds `keydown` listener on `document`:
  - If `event.key === 'Escape'`: calls `deactivate()` and sends `SELECTION_CANCELLED` to the service worker (so it can update the badge).

**`deactivate()`:**

- Removes `mouseover`, `click`, and `keydown` listeners.
- Removes `.ansura-hover` from any element that still has it.
- Restores `document.body.style.cursor = ''`.

**Highlight style** (injected once as a `<style>` tag into `document.head` on first `activate()`):

```css
.ansura-hover {
  outline: 2px solid rgba(99, 179, 237, 0.8) !important;
  box-shadow: 0 0 0 4px rgba(99, 179, 237, 0.15) !important;
}
```

> **Critical:** The highlight class must be removed synchronously inside the click handler, before `deactivate()` is called, so there is zero flicker of an outlined element after selection.

### 4.4 Overlay (`content/overlay.ts`)

Renders the answer UI into an isolated **Shadow DOM** root appended to `document.body`. This prevents the host page's CSS from breaking the overlay's appearance and prevents the overlay's CSS from leaking into the page.

Exports: `showAnswer(answer: string)`, `showError(message: string)`, `hide()`.

**`showAnswer(answer)`:**

- Creates (or reuses) the shadow host `<div>` and its shadow root.
- Sets the inner text to the answer string.
- Applies a `visible` class to trigger a CSS fade-in.
- Registers dismiss listeners (see below).

**Dismiss behaviour:**

- One-time `keydown` listener on `document` → calls `hide()`.
- One-time `click` listener on `document` → calls `hide()`.
  - Use `{ once: true }` on both `addEventListener` calls so they self-remove.

**`hide()`:**

- Removes the `visible` class → CSS fade-out transition plays.
- After the transition ends (`transitionend` event), removes the shadow host from the DOM.

**Overlay styles (within Shadow DOM):**

```css
:host {
  all: initial;
}

#ansura-root {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 2147483647;
  background: rgba(10, 10, 14, 0.85);
  color: rgba(255, 255, 255, 0.9);
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.5);
  max-width: 240px;
  pointer-events: auto;
  opacity: 0;
  transition: opacity 0.18s ease;
}

#ansura-root.visible {
  opacity: 1;
}
```

### 4.5 Options Page (`options/options.html` + `options.ts`)

- Simple form with:
  - **API Key** — `<input type="password">`. Saved value is shown as masked dots on reload.
  - **Model name** — `<input type="text">` with a placeholder like `gemini-2.5-pro`. Allows the user to type any valid model string without requiring a code change.
  - Save button with a brief "Saved ✓" confirmation.
- Reads/writes to `chrome.storage.sync`.
- Accessible via `chrome://extensions` → Ansura → Details → Extension options.

---

## 5. Message Protocol

All messages use a typed discriminated union. Define in `src/types/index.ts` and import in every file that sends or receives messages.

```typescript
// src/types/index.ts

/** Messages sent FROM the service worker TO the content script */
export type MessageToContent =
  | { type: 'TOGGLE_SELECTION_MODE' }
  | { type: 'SHOW_ANSWER'; answer: string }
  | { type: 'SHOW_ERROR'; message: string };

/** Messages sent FROM the content script TO the service worker */
export type MessageToBackground =
  | { type: 'ELEMENT_SELECTED'; html: string }
  | { type: 'SELECTION_CANCELLED' };
```

Use `switch (message.type)` in every `chrome.runtime.onMessage` listener. Never use string literals outside this file — always import the union type.

---

## 6. Gemini Integration — `@google/genai`

### 6.1 Library

Use the **official Google Gen AI SDK**: [`@google/genai`](https://www.npmjs.com/package/@google/genai).

```bash
npm install @google/genai
```

This is the current, actively maintained SDK (GA as of May 2025). It fully supports Gemini 2.0+ models and has first-class TypeScript types. The older `@google/generative-ai` package is deprecated and no longer receives new features — do not use it.

> **Bundling note:** `@google/genai` is a standard ESM/CJS package. It can be bundled into the MV3 service worker via webpack with `target: 'webworker'` for that entry. Do **not** import it in the content script — only the service worker makes API calls.

### 6.2 Usage in the Service Worker

```typescript
import { GoogleGenAI } from '@google/genai';

async function callGemini(html: string, apiKey: string, model: string): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
You are a quiz assistant. The following HTML contains a question and one or more answer choices.
Identify the correct answer. Respond with ONLY the answer text or letter — nothing else.
No explanation, no punctuation beyond what is in the answer itself.

HTML:
${html}
  `.trim();

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.1,
    },
  });

  const answer = response.text?.trim();
  if (!answer) throw new Error('Empty response from Gemini');
  return answer;
}
```

### 6.3 Prompt Design Notes

- Temperature `0.1` — as deterministic as possible for factual answers.
- The prompt instructs the model to return **only the answer text** — no preamble, no explanation. This matches the overlay requirement of showing the answer alone.
- If the API call fails or returns an empty string, the service worker catches the error and sends `SHOW_ERROR` to the content script.

### 6.4 Security Note

The API key is read from `chrome.storage.sync` inside the service worker and passed directly to `GoogleGenAI`. It is never forwarded to the content script or exposed to page JavaScript.

---

## 7. Manifest V3 (`manifest.json`)

```jsonc
{
  "manifest_version": 3,
  "name": "Ansura",
  "version": "1.0.0",
  "description": "Select a quiz element and get the correct answer via Gemini.",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://generativelanguage.googleapis.com/*"],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module",
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/content.js"],
      "run_at": "document_idle",
    },
  ],
  "action": {
    // NO "default_popup" — intentional.
    // Setting default_popup prevents chrome.action.onClicked from ever firing.
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png",
    },
    "default_title": "Ansura — Click to select an element",
  },
  "options_page": "options/options.html",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png",
  },
}
```

**MV3 constraints to keep in mind:**

- Service workers have no persistent memory between events. Do not rely on module-level variables surviving between separate `onMessage` or `onClicked` calls. Use `chrome.storage.session` for ephemeral cross-event state (e.g. tracking which tabs are in selection mode).
- `fetch()` and `@google/genai` work fine in service workers. They do **not** work reliably in content scripts on pages with strict CSPs.
- No remote code. Everything must be bundled into the extension package.

---

## 8. Build Setup

### 8.1 Dependencies

```json
{
  "dependencies": {
    "@google/genai": "^1.x"
  },
  "devDependencies": {
    "@types/chrome": "^0.x",
    "typescript": "^5.x",
    "webpack": "^5.x",
    "webpack-cli": "^5.x",
    "ts-loader": "^9.x",
    "copy-webpack-plugin": "^12.x"
  }
}
```

### 8.2 TypeScript Config

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "outDir": "dist",
    "lib": ["ES2020", "DOM"],
    "types": ["chrome"],
  },
  "include": ["src/**/*"],
}
```

### 8.3 Webpack Config

```js
// webpack.config.js
const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = [
  // --- Service worker: MUST use target 'webworker' ---
  {
    entry: { 'background/service-worker': './src/background/service-worker.ts' },
    target: 'webworker', // critical — service workers have no 'window'
    mode: 'production',
    module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: '[name].js' },
  },

  // --- Content script + options page: standard 'web' target ---
  {
    entry: {
      'content/content': './src/content/content.ts',
      'options/options': './src/options/options.ts',
    },
    target: 'web',
    mode: 'production',
    module: { rules: [{ test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ }] },
    resolve: { extensions: ['.ts', '.js'] },
    output: { path: path.resolve(__dirname, 'dist'), filename: '[name].js' },
    plugins: [
      new CopyPlugin({
        patterns: [
          { from: 'manifest.json', to: '.' },
          { from: 'public/icons', to: 'icons' },
          { from: 'src/options/options.html', to: 'options' },
        ],
      }),
    ],
  },
];
```

> **Why two configs?** The service worker must be compiled with `target: 'webworker'` so webpack uses the correct environment globals (`self`, no `window`). Content scripts run in page context and need `target: 'web'`. Mixing them in one config causes subtle runtime errors.

Build command: `npx webpack` → outputs to `dist/`. Load `dist/` as an unpacked extension in `chrome://extensions`.

---

## 9. Open Decisions (TBD)

| #   | Decision                  | Notes                                                                                                                                                                                 |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Default Gemini model**  | `gemini-2.0-flash` is fast and cheap; `gemini-2.5-pro` is more accurate. User can always override via options. Recommend shipping with `gemini-2.0-flash` as the default placeholder. |
| 2   | **API key storage scope** | `chrome.storage.sync` (roams across devices, 8KB limit) vs `chrome.storage.local` (device-only, 10MB limit). Sync is recommended — a simple API key string is well within the limit.  |

---

## 10. State Machine

```
[IDLE]
  │
  │  User clicks toolbar icon  (chrome.action.onClicked)
  ▼
[SELECTION_MODE_ACTIVE]
  │  badge = "ON", cursor = crosshair
  │  hover → .ansura-hover outline shown on element
  │
  ├── User presses Esc ──────────────────────────────► [IDLE]
  │   keydown handler in selector.ts                   badge = ""
  │
  └── User clicks element
        .ansura-hover removed immediately (sync)
        selector deactivated
        outerHTML → service worker
              │
              ▼
        [WAITING FOR GEMINI]
              │
              ├── Success ──► [ANSWER_SHOWN]
              │                    │
              │               User clicks or presses any key
              │                    │
              │                    ▼
              │                  [IDLE]
              │
              └── Error ───► [ERROR_SHOWN]
                                  │
                             User clicks or presses any key
                                  │
                                  ▼
                                [IDLE]
```

---

## 11. Security Considerations

- The API key lives only in `chrome.storage.sync` and is accessed only inside the service worker. It is never passed to content scripts or exposed to page JavaScript.
- `outerHTML` of the selected element is sent to Google's servers via the Gemini API. If the page element contains personally identifiable information (PII), that content will be sent. This should be clearly disclosed in the extension's Chrome Web Store privacy policy.
- Shadow DOM prevents page JavaScript from reading overlay content or injecting styles into it.
- `event.stopPropagation()` on the click during selection mode prevents accidental form submissions, navigation, or other page-level click handlers from firing.
- The extension requests only `activeTab`, `scripting`, and `storage` — no broad host permissions beyond the Gemini API endpoint.
