const { app, BrowserWindow, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
// Note: fileURLToPath import removed since __dirname is available in CommonJS.

const { initDatabase, saveSnippet, getAllSnippets, searchSnippets, deleteSnippet } = require('./services/db');
const { performOcr } = require('./services/ocr/ocr-service');
const { summarizeText, suggestTags, detectLanguage } = require('./services/ai/ai-client');

// Resolved directory of this file
const __dirnameResolved = __dirname;

let tray = null;
let emblemWindow = null;
let toolbarWindow = null;
let overlayWindow = null;
let currentCaptureDisplayId = null;
let windowStatePath = null;
let windowState = { x: undefined, y: undefined, width: 320, height: 600, isMaximized: false };
let isCollapsed = false;
let lastExpandedWidth = null;

function saveWindowState() {
  if (!toolbarWindow || !windowStatePath) return;
  if (isCollapsed) return; // don't persist collapsed width
  try {
    const bounds = toolbarWindow.getBounds();
    windowState.width = bounds.width;
    windowState.height = bounds.height;
    windowState.x = bounds.x;
    windowState.y = bounds.y;
    windowState.isMaximized = toolbarWindow.isMaximized();
    writeFileSync(windowStatePath, JSON.stringify(windowState, null, 2));
  } catch (err) {
    // best-effort, ignore
  }
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirnameResolved, '../../assets/icons/tray/trayTemplate.png')
  );
  tray = new Tray(trayIcon);
  tray.setToolTip('CodeCap');
  tray.on('click', () => {
    showToolbar();
  });
}

function toggleEmblem() {
  if (emblemWindow && emblemWindow.isVisible()) {
    emblemWindow.hide();
    return;
  }
  if (!emblemWindow) {
    emblemWindow = new BrowserWindow({
      width: 80,
      height: 40,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirnameResolved, '../preload/index.js'),
        contextIsolation: true
      }
    });
    emblemWindow.loadFile(path.join(__dirnameResolved, '../renderer/emblem.html'));
    emblemWindow.on('blur', () => {
      if (emblemWindow) emblemWindow.hide();
    });
  }
  const cursor = screen.getCursorScreenPoint();
  emblemWindow.setPosition(cursor.x - 40, cursor.y - 20);
  emblemWindow.show();
}

function showToolbar() {
  if (emblemWindow) emblemWindow.hide();
  let wasCreated = false;
  if (!toolbarWindow) {
    toolbarWindow = new BrowserWindow({
      x: windowState.x,
      y: windowState.y,
      width: windowState.width || 320,
      height: windowState.height || 600,
      frame: false,
      transparent: false,
      resizable: true,
      movable: true,
      minimizable: true,
      minWidth: 320,
      minHeight: 300,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirnameResolved, '../preload/index.js'),
        contextIsolation: true
      }
    });
    toolbarWindow.setMenuBarVisibility(false);
    toolbarWindow.loadFile(path.join(__dirnameResolved, '../renderer/toolbar.html'));
    // When minimized, hide instead so we can re-show on app activation easily
    toolbarWindow.on('minimize', (e) => {
      e.preventDefault();
      toolbarWindow.hide();
    });
    // Persist window state changes
    toolbarWindow.on('move', saveWindowState);
    toolbarWindow.on('resize', saveWindowState);
    toolbarWindow.on('maximize', saveWindowState);
    toolbarWindow.on('unmaximize', saveWindowState);
    toolbarWindow.on('blur', () => {
      if (toolbarWindow) {
        toolbarWindow.hide();
        const pos = toolbarWindow.getPosition();
        if (emblemWindow) {
          emblemWindow.setPosition(pos[0], pos[1]);
          emblemWindow.show();
        }
      }
    });
    if (windowState.isMaximized) {
      toolbarWindow.maximize();
    }
    wasCreated = true;
  }
  // Only reposition on first creation if we don't have a saved position
  if (wasCreated && (typeof windowState.x !== 'number' || typeof windowState.y !== 'number')) {
    const pos = emblemWindow ? emblemWindow.getPosition() : [100, 100];
    toolbarWindow.setPosition(pos[0], pos[1]);
  }
  toolbarWindow.show();
  toolbarWindow.focus();
}

function startCapture() {
  if (toolbarWindow) toolbarWindow.hide();

  // Choose the display nearest the cursor so the overlay appears where the user is working.
  const cursorPoint = screen.getCursorScreenPoint();
  const targetDisplay = screen.getDisplayNearestPoint(cursorPoint);
  const { x: dx, y: dy, width, height } = targetDisplay.bounds;

  if (!overlayWindow) {
    overlayWindow = new BrowserWindow({
      x: dx,
      y: dy,
      width,
      height,
      frame: false,
      transparent: true,
      resizable: false,
      movable: false,
      focusable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirnameResolved, '../preload/index.js'),
        contextIsolation: true
      }
    });
    overlayWindow.setIgnoreMouseEvents(false);
    overlayWindow.loadFile(path.join(__dirnameResolved, '../renderer/overlay.html'));
    overlayWindow.on('closed', () => {
      overlayWindow = null;
    });

    overlayWindow.webContents.once('did-finish-load', () => {
      currentCaptureDisplayId = String(targetDisplay.id);
      overlayWindow.setAlwaysOnTop(true, 'screen-saver');
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.webContents.send('overlay-start');
    });
  } else {
    // Reuse the overlay window by moving it to the target display and showing it
    overlayWindow.setBounds({ x: dx, y: dy, width, height });
    currentCaptureDisplayId = String(targetDisplay.id);
    overlayWindow.setAlwaysOnTop(true, 'screen-saver');
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.webContents.send('overlay-start');
  }
}

async function createApp() {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath);
  }
  // Prepare window-state persistence
  try {
    windowStatePath = path.join(userDataPath, 'window-state.json');
    if (existsSync(windowStatePath)) {
      const raw = readFileSync(windowStatePath, 'utf-8');
      const parsed = JSON.parse(raw);
      windowState = {
        x: typeof parsed.x === 'number' ? parsed.x : undefined,
        y: typeof parsed.y === 'number' ? parsed.y : undefined,
        width: typeof parsed.width === 'number' ? parsed.width : 320,
        height: typeof parsed.height === 'number' ? parsed.height : 600,
        isMaximized: !!parsed.isMaximized
      };
    }
  } catch (err) {
    // ignore corrupt state
    windowState = { x: undefined, y: undefined, width: 320, height: 600, isMaximized: false };
  }
  initDatabase(userDataPath);
  createTray();
  const shortcut = 'CommandOrControl+Shift+2';
  globalShortcut.register(shortcut, () => {
    startCapture();
  });
}

ipcMain.handle('show-toolbar', () => {
  showToolbar();
});

ipcMain.handle('start-capture', () => {
  startCapture();
});

ipcMain.handle('capture-region', async (_event, rect) => {
  const { x, y, width, height } = rect;
  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.find(d => String(d.id) === String(currentCaptureDisplayId)) ||
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scaleFactor = targetDisplay.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(targetDisplay.size.width * scaleFactor),
      height: Math.floor(targetDisplay.size.height * scaleFactor)
    }
  });
  if (!sources.length) {
    return { text: '', image: '', error: 'No screen sources available' };
  }
  // Prefer the source that matches the target display; fall back to the first source
  const screenSource =
    sources.find(s => String(s.display_id) === String(targetDisplay.id)) ||
    sources[0];
  const thumb = screenSource.thumbnail;
  const fullImg = nativeImage.createFromBuffer(thumb.toPNG());
  const cropRect = {
    x: Math.round(x * scaleFactor),
    y: Math.round(y * scaleFactor),
    width: Math.round(width * scaleFactor),
    height: Math.round(height * scaleFactor)
  };
  const cropped = fullImg.crop(cropRect);
  const buffer = cropped.toPNG();
  try {
    const ocrText = await performOcr(buffer);
    return { text: ocrText, image: buffer.toString('base64') };
  } catch (err) {
    console.error('OCR failed', err);
    return { text: '', image: buffer.toString('base64'), error: err.message || String(err) };
  }
});

ipcMain.handle('ai-process', async (_event, text) => {
  const summary = await summarizeText(text);
  const tags = await suggestTags(text);
  const language = await detectLanguage(text);
  return { summary, tags, language };
});

ipcMain.handle('save-snippet', async (_event, snippet) => {
  const saved = saveSnippet(snippet);
  return saved;
});

// Close or hide the overlay window when capture is finished or cancelled
ipcMain.handle('close-overlay', () => {
  if (overlayWindow) {
    // Hide the overlay but keep the instance for reuse to avoid re-creating
    overlayWindow.hide();
  }
});

ipcMain.handle('get-snippets', async () => {
  return getAllSnippets();
});

ipcMain.handle('search-snippets', async (_event, query) => {
  return searchSnippets(query);
});

ipcMain.handle('delete-snippet', async (_event, id) => {
  return deleteSnippet(id);
});

// Window controls from renderer
ipcMain.handle('window-minimize', () => {
  if (toolbarWindow) toolbarWindow.minimize();
});
ipcMain.handle('window-close', () => {
  if (toolbarWindow) toolbarWindow.hide();
});
ipcMain.handle('window-toggle-maximize', () => {
  if (toolbarWindow) {
    if (toolbarWindow.isMaximized()) toolbarWindow.unmaximize();
    else toolbarWindow.maximize();
  }
});

// Collapse/expand content area and resize window accordingly
ipcMain.handle('window-set-collapsed', (_event, collapsed) => {
  if (!toolbarWindow) return;
  isCollapsed = !!collapsed;
  const bounds = toolbarWindow.getBounds();
  const currentHeight = bounds.height;
  if (isCollapsed) {
    if (toolbarWindow.isMaximized()) toolbarWindow.unmaximize();
    lastExpandedWidth = bounds.width;
    toolbarWindow.setMinimumSize(60, 300);
    toolbarWindow.setSize(60, currentHeight);
  } else {
    toolbarWindow.setMinimumSize(320, 300);
    const targetWidth = Math.max(lastExpandedWidth || windowState.width || 320, 320);
    toolbarWindow.setSize(targetWidth, currentHeight);
  }
});

app.whenReady().then(() => {
  createApp().catch(err => console.error(err));
  // Always bring back/show the main toolbar window when the app is activated
  app.on('activate', () => {
    showToolbar();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  saveWindowState();
  globalShortcut.unregisterAll();
});