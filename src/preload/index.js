const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  showToolbar: () => ipcRenderer.invoke('show-toolbar'),
  startCapture: () => ipcRenderer.invoke('start-capture'),
  captureRegion: (rect) => ipcRenderer.invoke('capture-region', rect),
  aiProcess: (text) => ipcRenderer.invoke('ai-process', text),
  saveSnippet: (snippet) => ipcRenderer.invoke('save-snippet', snippet),
  getSnippets: () => ipcRenderer.invoke('get-snippets'),
  searchSnippets: (query) => ipcRenderer.invoke('search-snippets', query),
  onOverlayStart: (callback) => {
    ipcRenderer.on('overlay-start', callback);
  }
  ,
  /**
   * Request the main process to hide the capture overlay. This should be called
   * by the renderer after a capture is cancelled or completed to ensure the
   * overlay window is closed and UI control is returned to the user.
   */
  closeOverlay: () => ipcRenderer.invoke('close-overlay')
});

contextBridge.exposeInMainWorld('removeListeners', {
  all: () => ipcRenderer.removeAllListeners('overlay-start')
});