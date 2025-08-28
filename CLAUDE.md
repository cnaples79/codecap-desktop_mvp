# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeCap Desktop is an Electron application that captures text from any region of your screen using OCR. It's designed as a productivity tool for developers, product owners, and project managers to capture and organize code snippets, acceptance criteria, and notes from anywhere on their desktop.

## Development Commands

### Basic Commands
- `npm start` - Run the application in development mode
- `npm run dist` - Build the application for distribution using electron-builder

### Distribution
The app builds for multiple platforms using electron-builder configuration in `electron-builder.yml`. Output is generated in the `release/` directory.

## Architecture Overview

### Main Process (`src/main/main.js`)
- Entry point and primary Electron main process
- Manages all windows: system tray, floating emblem, toolbar, and overlay
- Handles global shortcuts (`Cmd/Ctrl+Shift+2` for capture)
- Coordinates screen capture workflow with desktopCapturer API
- Manages IPC communication between main and renderer processes
- Persists window state and user settings to JSON files in userData directory

### Window Architecture
1. **System Tray** - Lives in system tray, shows/hides emblem on click
2. **Floating Emblem** - Small `CC` badge that appears near cursor
3. **Vertical Toolbar** - Expandable panel with Codes/Cap/AI/Settings buttons
4. **Overlay Window** - Full-screen dimmed overlay for region selection during capture

### Services Layer (`src/main/services/`)

#### Database (`db.js`)
- Simple JSON-based storage for snippets in `snippets.json`
- In-memory array with file persistence on changes
- UUID-based record identification
- Search functionality by title/body text

#### OCR (`ocr/ocr-service.js`)
- Uses Tesseract.js for optical character recognition
- Processes captured image buffers to extract text
- Default language is English ('eng')

#### AI Client (`ai/ai-client.js`)
- Stubbed AI functionality for MVP
- Text summarization (currently truncates to 200 chars)
- Tag suggestion (extracts unique 5+ character words)
- Language detection (basic keyword matching)

#### Share (`share.js`)
- Formats snippets for export (Markdown, Plain Text, Code, JSON)
- GitHub Gist integration for sharing
- Multi-file export support
- File naming with slugification

### Renderer Processes (`src/renderer/`)
- **emblem.html/js** - Floating CC badge UI
- **toolbar.html/js** - Main application interface
- **overlay.html/js** - Screen capture selection overlay

### Preload (`src/preload/index.js`)
- Secure bridge between main and renderer processes
- Exposes IPC methods to renderer contexts

## Data Storage

### Local Storage
- **User Data Directory**: Settings and window state
  - `snippets.json` - All captured snippets
  - `settings.json` - User preferences (appearance, providers)  
  - `window-state.json` - Window position/size persistence
- **OCR Data**: Tesseract language files downloaded to node_modules

### Snippet Schema
```javascript
{
  id: 'uuid',
  title: 'string',
  body: 'string', 
  category: 'code|acceptance-criteria|notes',
  tags: ['array'],
  createdAt: timestamp,
  updatedAt: timestamp,
  aiSummary: 'string',
  aiTags: ['array'],
  language: 'string'
}
```

## Key Technical Details

### Screen Capture Pipeline
1. Global shortcut triggers capture mode
2. Overlay window covers target display
3. User selects region with drag gesture
4. desktopCapturer API screenshots entire display
5. Image cropped to selection bounds with scaling calculations
6. OCR processes cropped image buffer
7. Results presented in review modal

### Display Scaling Handling
The capture system handles multi-display setups and HiDPI scaling by:
- Detecting target display from cursor position
- Converting overlay coordinates to pixel coordinates
- Accounting for display scale factors and menu bar offsets
- Clamping selection bounds within image dimensions

### Window Management
- Persistent window state across app restarts
- Collapsible toolbar with width restoration
- Always-on-top behavior for capture workflow
- Platform-specific handling (especially macOS menu bar)

## Development Notes

### No Configuration Files
- No ESLint, Prettier, or TypeScript configuration
- Code uses CommonJS modules throughout
- No test framework currently configured

### Dependencies
- **electron**: Desktop application framework
- **tesseract.js**: OCR processing
- **uuid**: Unique identifier generation
- **electron-builder**: Application packaging/distribution

### File Structure Patterns
- Services use module.exports for CommonJS compatibility
- IPC handlers follow async/await patterns
- Settings and state use JSON file persistence
- HTML/JS renderer files are co-located