# UX Flows

## Tray → Emblem → Toolbar

1. **Launch**: When the user launches CodeCap, a small icon appears in the system tray.  The app has no dock/taskbar presence by default.
2. **Reveal Emblem**: Clicking the tray icon pops up a floating emblem near the cursor.  The emblem displays a stylish, cursive `CC` inside a rounded rectangle.  The emblem is draggable and always stays on top of other windows.
3. **Expand Toolbar**: Clicking the emblem causes the emblem to morph into a vertical toolbar.  The toolbar remains anchored at the emblem’s location and contains four buttons, stacked top to bottom: **Codes**, **Cap**, **AI** and **Settings**.  Hovering over a button reveals its label in a tooltip.
4. **Return to Emblem**: Clicking outside the toolbar or pressing the escape key collapses the toolbar back into the emblem.  Clicking the emblem again hides it entirely and returns control to the tray.

## Capture Flow (Cap Button)

1. **Start Capture**: The user clicks the **Cap** button or presses the global hotkey (default `Ctrl/Cmd+Shift+2`).
2. **Overlay**: The entire screen is dimmed with a translucent grey overlay.  The mouse cursor changes to a crosshair.
3. **Select Region**: The user clicks and drags to draw a rectangle over any part of their screen.  The overlay displays the selection rectangle with pixel dimensions.  Pressing escape cancels the capture.
4. **Capture & Crop**: When the mouse button is released, CodeCap takes a screenshot of the selected screen and crops it to the selection rectangle.
5. **OCR Extraction**: The cropped image is passed to an OCR engine.  The engine extracts the text and preserves indentation and basic formatting.
6. **Review Modal**: A modal appears showing the extracted text.  The user can edit the title, choose a category (code, acceptance criteria, notes) and decide whether to enable AI summarisation and tag suggestions.
7. **Save**: On confirmation, the capture is saved to the local database.  If AI is enabled, summarisation and tagging tasks run asynchronously.  The modal closes and the overlay disappears.

## Codes List (Codes Button)

1. **Open Codes**: Clicking the **Codes** button opens a list of saved captures.  Each item shows its title, creation date, category and a short preview.
2. **Search & Filter**: The user can search by title, body text or tags.  Filters allow narrowing by category or tag.
3. **Actions**: For each item, quick actions include copying the body to the clipboard, opening the full detail view and sharing with a collaborator.
4. **Detail View**: Opening an item shows the full capture, AI summary and tags.  The user can edit fields, add comments and view share recipients.

## AI Panel (AI Button)

The AI panel contains toggles and configuration for built‑in AI features.  Users can enable or disable AI summarisation and tagging globally, select an AI provider and input their API key.  Additional experimental features can be toggled here as they are introduced.

## Settings (Settings Button)

The Settings panel allows users to change the global hotkey, choose OCR languages, toggle whether raw images are retained after capture and adjust visual themes (high contrast, dark/light).  Users can also manage their account details and see basic telemetry opt‑in/opt‑out settings.