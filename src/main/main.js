const { app, BrowserWindow, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer, dialog, shell } = require('electron');
const path = require('path');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
// Note: fileURLToPath import removed since __dirname is available in CommonJS.

const { initDatabase, saveSnippet, getAllSnippets, searchSnippets, deleteSnippet, getSnippetById, updateSnippetAi } = require('./services/db');
const { performOcr } = require('./services/ocr/ocr-service');
const { summarizeText, suggestTags, detectLanguage, explainCode, setOpenRouterKey, setAiSettings, getAiSettings } = require('./services/ai/ai-client');
const { formatForShare, createGist } = require('./services/share');

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

// Settings persistence (appearance, etc.)
let settingsPath = null;
let settings = {
  appearance: {
    mode: 'dark', // 'light' | 'dark' | 'system'
    theme: 'blue' // 'blue' | 'green' | 'purple' | 'gray'
  },
  providers: {
    githubToken: '',
    openRouterKey: ''
  },
  ai: {
    enabled: true,
    explainCode: true,
    summarizeText: true,
    suggestTags: true,
    model: 'deepseek/deepseek-r1-0528:free'
  }
};

function loadSettings(userDataPath) {
  try {
    settingsPath = path.join(userDataPath, 'settings.json');
    if (existsSync(settingsPath)) {
      const raw = readFileSync(settingsPath, 'utf-8');
      const parsed = JSON.parse(raw);
      settings = { ...settings, ...parsed };
      
      // Initialize AI client with loaded settings
      if (settings.providers?.openRouterKey) {
        setOpenRouterKey(settings.providers.openRouterKey);
      }
      if (settings.ai) {
        setAiSettings(settings.ai);
      }
    }
  } catch (e) {
    // ignore and use defaults
  }
}

function saveSettings() {
  try {
    if (!settingsPath) return;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch (e) {
    // ignore
  }
}

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
    // Note: No auto-hide on blur; keep window visible unless user minimizes
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
  // Apply collapsed width if persisted
  if (isCollapsed && toolbarWindow) {
    const bounds = toolbarWindow.getBounds();
    toolbarWindow.setMinimumSize(60, 300);
    toolbarWindow.setSize(60, bounds.height);
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
      if (typeof parsed.collapsed === 'boolean') {
        isCollapsed = parsed.collapsed;
      }
    }
  } catch (err) {
    // ignore corrupt state
    windowState = { x: undefined, y: undefined, width: 320, height: 600, isMaximized: false };
  }
  // Load settings
  loadSettings(userDataPath);
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
  const { x, y, width, height, viewport } = rect || {};
  const displays = screen.getAllDisplays();
  const targetDisplay =
    displays.find(d => String(d.id) === String(currentCaptureDisplayId)) ||
    screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scaleFactor = targetDisplay.scaleFactor || 1;
  const displayBounds = targetDisplay.bounds; // DIP units
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    // Request a thumbnail that corresponds to the display bounds at device scale
    thumbnailSize: {
      width: Math.floor(displayBounds.width * scaleFactor),
      height: Math.floor(displayBounds.height * scaleFactor)
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
  // Compute scaling from overlay DIP coordinates to actual image pixels
  const imgSize = fullImg.getSize(); // pixels
  // Use display bounds (DIP) as the authoritative basis
  const basisWidth = displayBounds.width;
  const basisHeight = displayBounds.height;
  const scaleX = imgSize.width / basisWidth;
  const scaleY = imgSize.height / basisHeight;
  // Account for cases where the overlay window cannot be positioned at the exact
  // display top-left (e.g., macOS menu bar). We correct by adding the overlay's
  // offset within the display to the selection coordinates.
  let offsetX = 0;
  let offsetY = 0;
  try {
    if (overlayWindow) {
      const ob = overlayWindow.getBounds();
      offsetX = (ob.x || 0) - (displayBounds.x || 0);
      offsetY = (ob.y || 0) - (displayBounds.y || 0);
    }
  } catch {}
  const pad = 2; // small padding to avoid missing edges due to rounding
  const adjX = (x || 0) + offsetX;
  const adjY = (y || 0) + offsetY;
  // Clamp DIP coordinates within display bounds first
  const clampedAdjX = Math.max(0, Math.min(adjX, basisWidth - 1));
  const clampedAdjY = Math.max(0, Math.min(adjY, basisHeight - 1));
  const clampedWidthDip = Math.max(1, Math.min(width || 1, basisWidth - clampedAdjX));
  const clampedHeightDip = Math.max(1, Math.min(height || 1, basisHeight - clampedAdjY));

  // Convert to pixel coordinates
  let pxX = Math.round(clampedAdjX * scaleX) - pad;
  let pxY = Math.round(clampedAdjY * scaleY) - pad;
  let pxW = Math.round(clampedWidthDip * scaleX) + pad * 2;
  let pxH = Math.round(clampedHeightDip * scaleY) + pad * 2;

  // Clamp pixel coordinates within image bounds
  if (pxX < 0) pxX = 0;
  if (pxY < 0) pxY = 0;
  if (pxX >= imgSize.width) pxX = Math.max(0, imgSize.width - 1);
  if (pxY >= imgSize.height) pxY = Math.max(0, imgSize.height - 1);
  const maxPW = Math.max(1, imgSize.width - pxX);
  const maxPH = Math.max(1, imgSize.height - pxY);
  pxW = Math.max(1, Math.min(pxW, maxPW));
  pxH = Math.max(1, Math.min(pxH, maxPH));

  let cropRect = { x: pxX, y: pxY, width: pxW, height: pxH };
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

ipcMain.handle('ai-process', async (_event, text, options = {}) => {
  try {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return { success: false, error: 'No text provided for AI processing' };
    }

    const results = {};
    const language = await detectLanguage(text);
    results.language = language;
    
    // Run AI processing based on options
    const promises = [];
    
    if (options.summarize !== false) {
      promises.push(
        summarizeText(text)
          .then(summary => { results.summary = summary; })
          .catch(err => { 
            console.error('Summarization failed:', err);
            results.summary = 'Summarization failed: ' + err.message;
          })
      );
    }
    
    if (options.tags !== false) {
      promises.push(
        suggestTags(text, language)
          .then(tags => { results.tags = Array.isArray(tags) ? tags : []; })
          .catch(err => {
            console.error('Tag suggestion failed:', err);
            results.tags = [];
          })
      );
    }
    
    if (options.explain && language === 'code') {
      promises.push(
        explainCode(text)
          .then(explanation => { results.explanation = explanation; })
          .catch(err => {
            console.error('Code explanation failed:', err);
            results.explanation = 'Code explanation failed: ' + err.message;
          })
      );
    }
    
    await Promise.allSettled(promises);
    return { success: true, ...results };
  } catch (error) {
    console.error('AI processing failed:', error);
    return { success: false, error: error.message || 'AI processing failed' };
  }
});

// Individual AI operations
ipcMain.handle('ai-explain-code', async (_event, text) => {
  try {
    const explanation = await explainCode(text);
    return { success: true, explanation };
  } catch (error) {
    console.error('Code explanation failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-summarize', async (_event, text) => {
  try {
    const summary = await summarizeText(text);
    return { success: true, summary };
  } catch (error) {
    console.error('Text summarization failed:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ai-suggest-tags', async (_event, text, context) => {
  try {
    const tags = await suggestTags(text, context);
    return { success: true, tags };
  } catch (error) {
    console.error('Tag suggestion failed:', error);
    return { success: false, error: error.message };
  }
});

// Update snippet with AI results
ipcMain.handle('update-snippet-ai', async (_event, id, aiData) => {
  try {
    const updated = updateSnippetAi(id, aiData);
    if (updated) {
      return { success: true, snippet: updated };
    } else {
      return { success: false, error: 'Snippet not found' };
    }
  } catch (error) {
    console.error('Update snippet AI failed:', error);
    return { success: false, error: error.message };
  }
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

// Open external links (mailto, http/https)
ipcMain.handle('open-external', (_event, url) => {
  try {
    if (typeof url !== 'string' || !url) return { success: false };
    shell.openExternal(url);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
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
  // persist collapsed flag
  try {
    if (windowStatePath) {
      const snapshot = { ...windowState, collapsed: isCollapsed };
      writeFileSync(windowStatePath, JSON.stringify(snapshot, null, 2));
    }
  } catch {}
});

// Settings IPC
ipcMain.handle('get-settings', () => ({ 
  appearance: settings.appearance,
  ai: settings.ai
}));
ipcMain.handle('set-settings', (_event, partial) => {
  settings = { ...settings, ...partial };
  
  // Update AI client if AI settings changed
  if (partial.ai) {
    setAiSettings(partial.ai);
  }
  
  saveSettings();
  return { 
    appearance: settings.appearance,
    ai: settings.ai
  };
});

// UI state (collapsed, etc.)
ipcMain.handle('get-ui-state', () => ({ collapsed: isCollapsed }));

// Provider status (do not leak secrets)
ipcMain.handle('get-provider-status', () => ({
  githubConfigured: !!(settings && settings.providers && settings.providers.githubToken),
  openRouterConfigured: !!(settings && settings.providers && settings.providers.openRouterKey)
}));

// Set provider credential (write-only)
ipcMain.handle('set-provider-credential', (_event, { provider, value }) => {
  if (!settings.providers) settings.providers = {};
  if (provider === 'github') {
    settings.providers.githubToken = String(value || '');
  } else if (provider === 'openrouter') {
    settings.providers.openRouterKey = String(value || '');
    setOpenRouterKey(settings.providers.openRouterKey);
  }
  saveSettings();
  return { success: true };
});

// Export snippets
ipcMain.handle('export-snippets', async () => {
  const win = toolbarWindow || BrowserWindow.getFocusedWindow();
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Snippets',
    defaultPath: 'snippets-export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (canceled || !filePath) return { success: false };
  try {
    const data = getAllSnippets();
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Share: format preview/build
ipcMain.handle('share-format', (_event, { snippets, options }) => {
  try {
    const result = formatForShare(snippets || [], options || {});
    return { success: true, result };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Share: save to file (single or multi-file)
ipcMain.handle('share-to-file', async (_event, { snippets, options }) => {
  try {
    const { content, defaultName, filesMap } = formatForShare(snippets || [], options || {});
    const win = toolbarWindow || BrowserWindow.getFocusedWindow();
    if (filesMap) {
      const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select a folder to save files',
        properties: ['openDirectory', 'createDirectory']
      });
      if (canceled || !filePaths || !filePaths[0]) return { success: false, canceled: true };
      const targetDir = filePaths[0];
      for (const [name, data] of Object.entries(filesMap)) {
        const dest = path.join(targetDir, name);
        writeFileSync(dest, data, 'utf-8');
      }
      return { success: true, directory: targetDir, files: Object.keys(filesMap) };
    }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Save shared content',
      defaultPath: defaultName || 'snippet.txt'
    });
    if (canceled || !filePath) return { success: false, canceled: true };
    writeFileSync(filePath, content || '', 'utf-8');
    return { success: true, filePath };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Share: GitHub Gist
ipcMain.handle('share-to-gist', async (_event, { snippets, options, description, isPublic, token }) => {
  try {
    const { content, defaultName, filesMap } = formatForShare(snippets || [], options || {});
    const ghToken = token || settings?.providers?.githubToken;
    if (!ghToken) {
      return { success: false, error: 'GitHub token not configured' };
    }
    const files = filesMap || { [defaultName || 'snippet.txt']: content || '' };
    const res = await createGist({ filesMap: files, description: description || 'Shared via CodeCap', public: !!isPublic, token: ghToken });
    return { success: true, url: res.url, id: res.id };
  } catch (e) {
    return { success: false, error: e.message };
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