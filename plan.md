# CodeCap Desktop MVP – Analysis (as of 2025-08-22)

This document summarizes the current state of the CodeCap Electron MVP based on the repository contents and observed behavior when running the app.

## Overview

- The app is an Electron MVP that lives in the system tray and exposes an emblem and vertical toolbar UI.
- Core capture flow is implemented: dim overlay, region selection, screenshot crop, OCR via Tesseract.js, optional AI (stub), and local persistence.
- Many features described in README/docs are scoped as MVP or are not yet wired (e.g., SQLite, encryption, full settings, sharing).

## Run/Build Configuration

- Entry: `"main": "src/main/main.js"` in `package.json`.
- Scripts:
  - `npm start` → `electron .` (works for dev).
  - `npm run dist` → `electron-builder` (packaging). Note: README says `npm run build`; there is no `build` script.
- `electron-builder.yml` outputs to `release/`, not `dist/` as README claims. A `scripts/copy-assets.sh` exists but is unused and targets `dist/`.

## UI/UX Windows

- Tray and emblem: `src/main/main.js` creates a Tray and a small emblem `BrowserWindow` (`src/renderer/emblem.html`), which toggles the toolbar.
- Toolbar window: `src/renderer/toolbar.html` with four buttons: Codes, Cap, AI, Settings. Behavior implemented in `toolbar.js`.
- Overlay window: full-screen transparent overlay on the primary display (`overlay.html`/`overlay.js`) to draw a selection rectangle and invoke capture.

## Capture & OCR

- Capture: Uses `desktopCapturer.getSources({ types: ['screen'] })` and selects `sources[0]`. Cropping is computed using the primary display scale factor.
- OCR: `src/main/services/ocr/ocr-service.js` via `tesseract.js` recognizing the cropped PNG buffer. Default language is hardcoded to `eng` and not configurable at runtime.
- Limitations:
  - Multi-monitor support is limited: the overlay and scale calculations use only the primary display and `sources[0]`; secondary displays are likely unsupported.
  - No error UI beyond `alert()` in the overlay; failure states are not robustly handled.

## AI (Stubbed)

- AI client: `src/main/services/ai/ai-client.js` provides:
  - `summarizeText()` → truncates to ~200 chars.
  - `suggestTags()` → naive token extraction (first 3 unique words >4 chars).
  - `detectLanguage()` → simple heuristics for "code" vs "plain".
- No external API or key usage; `.env.example` suggests future AI integration.

## Data Persistence

- Implemented via JSON file, not SQLite: `src/main/services/db.js` stores items in `<userData>/snippets.json` with `uuid` IDs.
- Fields: `id, title, body, category, tags, createdAt, updatedAt, aiSummary, aiTags, language` (note: `language` is not set by the overlay save flow).
- README/docs claim SQLite and at-rest encryption; not present in code.

## Renderer Panels

- Codes: Lists snippets loaded via `window.api.getSnippets()` and allows basic search (client-side filter) and click-to-copy.
- AI: Static stub text for now.
- Settings: Shows readonly hotkey and an OCR languages text input. The "Save Settings" button only logs to console; no persistence and not wired to OCR.

## IPC & Preload Security

- Preload (`src/preload/index.js`) exposes `api` methods: `showToolbar`, `startCapture`, `captureRegion`, `aiProcess`, `saveSnippet`, `getSnippets`, `searchSnippets`, `closeOverlay`, `onOverlayStart`.
- `contextIsolation: true` with `contextBridge` is used. `nodeIntegration` is not enabled (good practice).

## Assets & Packaging

- Tray icon path: `src/main/main.js` points to `../../assets/icons/tray/trayTemplate.png`.
- There is no `assets/` directory in the repo. The tray may render a blank/default icon at runtime; packaging rules reference `assets/**/*` but nothing to include.
- `scripts/copy-assets.sh` creates `dist/` folders and copies `assets/` if present; not referenced by `package.json` and likely stale.

## Permissions

- Permissions doc is consistent with the capture approach. On macOS, screen recording permission will be required when using `desktopCapturer`.

## Testing

- `docs/testing-plan.md` references tests in `src/tests`; no such directory is present. No test tooling configured in `package.json`.

## Doc Mismatches vs Implementation

- README/docs state SQLite with encryption; code uses JSON file without encryption.
- README says `npm run build` and output to `dist/`; actual script is `dist` (electron-builder) and output configured as `release/`.
- Settings and AI configuration are described but not functionally implemented.
- Sharing and comments are mentioned in docs/UX but not implemented.

## Known Risks and Gaps

- Missing assets lead to potential tray icon visibility issues on some platforms.
- Multi-monitor capture support is incomplete; DPI/scale handling may be incorrect off primary display.
- OCR language selection is not wired to user input; performance of Tesseract.js may need worker management/caching.
- No persistence for settings; no schema migrations for snippets; no telemetry/opt-out implemented despite docs mention.
- Packaging/signing, auto-update, and CI are not configured.

## Current State Summary

- The MVP runs, shows emblem/toolbar, performs region capture on the primary display, extracts text via Tesseract, and saves snippets to a local JSON file. AI summary/tagging are stubbed. Codes list and basic search/copy work. Settings and AI panels are mostly UI placeholders. Several documentation claims (SQLite, encryption, build script name, output dir, sharing) do not match the code.
