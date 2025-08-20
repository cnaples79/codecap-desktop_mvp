const { app, BrowserWindow, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer } = require('electron');
const path = require('path');
const { existsSync, mkdirSync } = require('fs');
// Note: fileURLToPath import removed since __dirname is available in CommonJS.

const { initDatabase, saveSnippet, getAllSnippets, searchSnippets } = require('./services/db');
const { performOcr } = require('./services/ocr/ocr-service');
const { summarizeText, suggestTags, detectLanguage } = require('./services/ai/ai-client');

// Resolved directory of this file
const __dirnameResolved = __dirname;

let tray = null;
let emblemWindow = null;
let toolbarWindow = null;
let overlayWindow = null;

function createTray() {
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirnameResolved, '../../assets/icons/tray/trayTemplate.png')
  );
  tray = new Tray(trayIcon);
  tray.setToolTip('CodeCap');
  tray.on('click', () => {
    toggleEmblem();
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
  if (!toolbarWindow) {
    toolbarWindow = new BrowserWindow({
      width: 320,
      height: 600,
      frame: false,
      transparent: false,
      resizable: false,
      alwaysOnTop: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirnameResolved, '../preload/index.js'),
        contextIsolation: true
      }
    });
    toolbarWindow.setMenuBarVisibility(false);
    toolbarWindow.loadFile(path.join(__dirnameResolved, '../renderer/toolbar.html'));
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
  }
  const pos = emblemWindow ? emblemWindow.getPosition() : [100, 100];
  toolbarWindow.setPosition(pos[0], pos[1]);
  toolbarWindow.show();
  toolbarWindow.focus();
}

function startCapture() {
  if (toolbarWindow) toolbarWindow.hide();
  if (!overlayWindow) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: dx, y: dy, width, height } = primaryDisplay.bounds;
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
  }
  overlayWindow.setAlwaysOnTop(true, 'screen-saver');
  overlayWindow.show();
  overlayWindow.focus();
  overlayWindow.webContents.send('overlay-start');
}

async function createApp() {
  const userDataPath = app.getPath('userData');
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath);
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
  const primary = screen.getPrimaryDisplay();
  const scaleFactor = primary.scaleFactor || 1;
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.floor(primary.size.width * scaleFactor),
      height: Math.floor(primary.size.height * scaleFactor)
    }
  });
  if (!sources.length) {
    return { text: '', image: '', error: 'No screen sources available' };
  }
  const screenSource = sources[0];
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

app.whenReady().then(() => {
  createApp().catch(err => console.error(err));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      showToolbar();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});