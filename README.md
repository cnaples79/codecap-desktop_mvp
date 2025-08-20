# CodeCap Desktop

CodeCap is a productivity tool for developers, product owners and project managers.  It lets you capture a region of your screen—much like Snagit—but with a focus on text and code.  After you drag a rectangle across any application, CodeCap uses Optical Character Recognition (OCR) to extract the text while preserving indentation and basic formatting.  It then organises the capture into your personal library with optional AI‑generated summaries and tags.  You can search your captures, copy them back to the clipboard, share them with collaborators and manage basic settings such as keyboard shortcuts, AI preferences and privacy options.

This repository contains the Electron desktop MVP.  The app sits in your system tray.  Clicking the tray icon reveals a floating emblem (`CC`).  Clicking the emblem expands a vertical toolbar with buttons for **Codes**, **Cap**, **AI** and **Settings**.  From there you can start a capture, view your library of saved snippets, toggle AI functions or adjust preferences.

## Getting started

1. **Install dependencies**

   ```sh
   cd codecap-desktop
   npm install
   ```

2. **Run the app in development mode**

   ```sh
   npm start
   ```

   The first time you run the app it will ask for screen capture permissions.  After granting permission you can use the global hotkey (default `Ctrl+Shift+2` on Windows/Linux or `Cmd+Shift+2` on macOS) to start a capture.

3. **Build for production**

   ```sh
   npm run build
   ```

   Builds the app for distribution using [electron-builder](https://www.electron.build/).  The output can be found in the `dist/` directory.

## Features

* **System tray & floating emblem** – the app lives in your system tray.  Click the tray icon to reveal a floating emblem.  Click the emblem to expand a vertical toolbar.
* **Vertical toolbar** – narrow, always-on-top window with four buttons: Codes, Cap, AI and Settings.  Hover over a button to see its name.
* **Capture anything** – click the `Cap` button (or press the global hotkey) to dim your screen.  Drag a rectangle across any window.  CodeCap captures the region, runs OCR to extract text and preserves indentation.  You can review the capture, categorise it (code, acceptance criteria or notes) and save it.
* **AI summaries and tags** – optional AI processing generates a short summary and suggests tags for the captured text.  For the MVP this functionality is stubbed but is architected for plugging into a real LLM provider.
* **Organise and search** – your captures are stored locally in a SQLite database.  You can search by title, body or tags, filter by category and copy items back to the clipboard.
* **Share** – invite another user by email/username to view or comment on a capture.  Sharing is simple for the MVP and does not yet support real‑time collaboration or team workspaces.
* **Settings** – manage keyboard shortcuts, AI provider keys, OCR language packs, theme and privacy options.  You can opt in/out of storing raw images after OCR.

## Contributing

This is an MVP built for demonstration purposes.  The architecture is designed to be extensible, but many advanced features (e.g. real‑time editing, cloud sync) are intentionally scoped out.  If you wish to contribute code please open an issue first to discuss your proposed change.

## License

This project is licensed under the MIT License.  See the [`LICENSE`](LICENSE) file for details.