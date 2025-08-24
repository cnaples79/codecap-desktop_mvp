// Toolbar script for CodeCap

// Elements
const btnCodes = document.getElementById('btn-codes');
const btnCap = document.getElementById('btn-cap');
const btnAi = document.getElementById('btn-ai');
const btnSettings = document.getElementById('btn-settings');
const btnShare = document.getElementById('btn-share');
const sidebar = document.querySelector('.sidebar');

const panelCodes = document.getElementById('panel-codes');
const panelAi = document.getElementById('panel-ai');
const panelSettings = document.getElementById('panel-settings');
const panelShare = document.getElementById('panel-share');

const codesList = document.getElementById('codes-list');
const searchBar = document.getElementById('search-bar');
const titlebarEl = document.getElementById('titlebar');
const btnWinMin = document.getElementById('win-min');
const btnWinMax = document.getElementById('win-max');
const btnWinClose = document.getElementById('win-close');

// Settings controls
const modeSelect = document.getElementById('mode-select');
const themeSelect = document.getElementById('theme-select');
const exportBtn = document.getElementById('btn-export-snippets');
// Share panel controls
const shareSearch = document.getElementById('share-search');
const shareList = document.getElementById('share-list');
const shareSelectAll = document.getElementById('share-select-all');
const shareClipboardBtn = document.getElementById('share-clipboard');
const shareFileBtn = document.getElementById('share-file');
const shareGistBtn = document.getElementById('share-gist');
const shareEmailBtn = document.getElementById('share-email');
const shareIncludeTitle = document.getElementById('share-include-title');
const shareIncludeMeta = document.getElementById('share-include-meta');
const shareCombine = document.getElementById('share-combine');
const shareLanguage = document.getElementById('share-language');
const gistPublic = document.getElementById('gist-public');
const gistDesc = document.getElementById('gist-desc');
const gistStatus = document.getElementById('gist-status');
// Provider settings controls
const githubTokenInput = document.getElementById('github-token');
const saveGithubTokenBtn = document.getElementById('save-github-token');
const githubStatus = document.getElementById('github-status');

// Toasts
const toastContainer = document.getElementById('toast-container');
function showToast(message, type = 'success', duration = 2200) {
  try {
    if (!toastContainer) { alert(message); return; }
    const el = document.createElement('div');
    el.className = `toast ${type || ''}`.trim();
    el.textContent = message;
    toastContainer.appendChild(el);
    const remove = () => {
      el.style.animation = 'toast-out 160ms ease-in forwards';
      setTimeout(() => el.remove(), 160);
    };
    setTimeout(remove, Math.max(1200, duration || 2200));
    el.addEventListener('click', remove);
  } catch {
    try { alert(message); } catch {}
  }
}

let allSnippets = [];
let isCollapsed = false;
let currentSettings = null;
let shareSelected = new Set();

function setActiveButton(button) {
  [btnCodes, btnCap, btnAi, btnSettings, btnShare].forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
}

function showPanel(panel) {
  [panelCodes, panelAi, panelSettings, panelShare].forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

function applyAppearance(settings) {
  if (!settings) return;
  currentSettings = settings;
  const mode = settings.appearance?.mode || 'dark';
  const theme = settings.appearance?.theme || 'blue';
  // Resolve effective mode (system uses prefers-color-scheme)
  let effectiveMode = mode;
  if (mode === 'system') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    effectiveMode = prefersDark ? 'dark' : 'light';
  }
  document.body.classList.toggle('light', effectiveMode === 'light');
  // Apply theme class
  ['theme-blue','theme-green','theme-purple','theme-gray'].forEach(c => document.body.classList.remove(c));
  document.body.classList.add(`theme-${theme}`);
}

async function loadSnippets() {
  allSnippets = await window.api.getSnippets();
  renderList(allSnippets);
  // keep Share panel in sync
  if (panelShare.classList.contains('active')) {
    renderShareList(shareSearch ? shareSearch.value.trim() : '');
  }
}

function renderList(list) {
  codesList.innerHTML = '';
  list.forEach(item => {
    const li = document.createElement('li');
    li.title = 'Left-click to expand/collapse. Right-click to copy.';
    const titleEl = document.createElement('h4');
    titleEl.textContent = item.title;
    const previewEl = document.createElement('p');
    previewEl.textContent = item.body.slice(0, 80).replace(/\n+/g, ' ');
    const codeEl = document.createElement('pre');
    codeEl.className = 'code-block';
    codeEl.textContent = item.body;

    // Action buttons (edit/delete)
    const actions = document.createElement('div');
    actions.className = 'snippet-actions';
    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn';
    shareBtn.title = 'Share';
    shareBtn.textContent = '📤';
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.title = 'Edit';
    editBtn.textContent = '✎';
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn';
    delBtn.title = 'Delete';
    delBtn.textContent = '🗑';
    actions.appendChild(shareBtn);
    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    li.appendChild(titleEl);
    li.appendChild(previewEl);
    li.appendChild(codeEl);
    li.appendChild(actions);

    // Left click: toggle expanded code visibility
    li.addEventListener('click', () => {
      codeEl.classList.toggle('visible');
    });

    // Right click: copy full snippet body to clipboard
    li.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      navigator.clipboard.writeText(item.body).then(() => {
        const prev = titleEl.textContent;
        titleEl.textContent = 'Copied!';
        setTimeout(() => {
          titleEl.textContent = prev;
        }, 1000);
      });
    });

    // Quick share
    shareBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveButton(btnShare);
      showPanel(panelShare);
      shareSelected = new Set([item.id]);
      renderShareList(shareSearch ? shareSearch.value.trim() : '');
      showToast('Prepared to share this snippet', 'success', 1400);
    });

    // Delete
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ok = confirm('Delete this snippet?');
      if (!ok) return;
      try {
        await window.api.deleteSnippet(item.id);
        await loadSnippets();
      } catch (err) {
        console.error('Delete failed', err);
      }
    });

    // Edit inline
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showEditor(li, item, { titleEl, previewEl, codeEl });
    });

    codesList.appendChild(li);
  });
}

function showEditor(li, item, refs) {
  // Prevent duplicate editors
  if (li.querySelector('.editor-container')) return;
  li.classList.add('editing');
  const { titleEl, previewEl, codeEl } = refs;
  // Hide preview/code while editing
  if (previewEl) previewEl.style.display = 'none';
  if (codeEl) codeEl.style.display = 'none';

  const editor = document.createElement('div');
  editor.className = 'editor-container';
  editor.innerHTML = `
    <label>Title</label>
    <input type="text" class="edit-title" value="${escapeHtml(item.title)}" />
    <label style="margin-top:6px; display:block;">Body</label>
    <textarea class="edit-body" rows="6">${escapeHtml(item.body)}</textarea>
    <div style="margin-top:8px; display:flex; gap:8px;">
      <button class="small-button btn-save">Save</button>
      <button class="small-button btn-cancel" style="background-color:#555;">Cancel</button>
    </div>
  `;
  li.appendChild(editor);

  // Stop propagation inside editor
  editor.addEventListener('click', (e) => e.stopPropagation());
  editor.addEventListener('contextmenu', (e) => e.stopPropagation());

  const inputTitle = editor.querySelector('.edit-title');
  const inputBody = editor.querySelector('.edit-body');
  const btnSave = editor.querySelector('.btn-save');
  const btnCancel = editor.querySelector('.btn-cancel');

  btnSave.addEventListener('click', async () => {
    const newTitle = inputTitle.value.trim() || 'Untitled';
    const newBody = inputBody.value;
    try {
      await window.api.saveSnippet({ id: item.id, title: newTitle, body: newBody });
      await loadSnippets();
    } catch (err) {
      console.error('Save failed', err);
    }
  });

  btnCancel.addEventListener('click', () => {
    editor.remove();
    if (previewEl) previewEl.style.display = '';
    if (codeEl) codeEl.style.display = '';
    li.classList.remove('editing');
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getShareOptions(overrides = {}) {
  const fmtEl = document.querySelector('input[name="share-format"]:checked');
  const format = fmtEl ? fmtEl.value : 'markdown';
  const includeTitle = !!(shareIncludeTitle && shareIncludeTitle.checked);
  const includeMeta = !!(shareIncludeMeta && shareIncludeMeta.checked);
  const combine = !!(shareCombine && shareCombine.checked);
  const language = shareLanguage ? shareLanguage.value : 'auto';
  return { format, includeTitle, includeMeta, combine, language, ...overrides };
}

function getFilteredSnippets(query) {
  const q = String(query || '').toLowerCase();
  if (!q) return allSnippets.slice();
  return allSnippets.filter(s =>
    (s.title || '').toLowerCase().includes(q) || (s.body || '').toLowerCase().includes(q)
  );
}

function getSelectedSnippets() {
  const set = shareSelected;
  return allSnippets.filter(s => set.has(s.id));
}

function renderShareList(query) {
  if (!shareList) return;
  const filtered = getFilteredSnippets(query);
  shareList.innerHTML = '';
  filtered.forEach(s => {
    const li = document.createElement('li');
    li.style.display = 'flex';
    li.style.alignItems = 'center';
    li.style.gap = '8px';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = shareSelected.has(s.id);
    cb.addEventListener('change', () => {
      if (cb.checked) shareSelected.add(s.id); else shareSelected.delete(s.id);
      // Update select-all state based on filtered view
      const allChecked = filtered.every(x => shareSelected.has(x.id));
      if (shareSelectAll) shareSelectAll.checked = allChecked;
    });
    const label = document.createElement('span');
    label.textContent = s.title || '(untitled)';
    label.style.flex = '1';
    li.appendChild(cb);
    li.appendChild(label);
    shareList.appendChild(li);
  });
  // Update select-all based on filtered view
  const allChecked = filtered.length > 0 && filtered.every(x => shareSelected.has(x.id));
  if (shareSelectAll) shareSelectAll.checked = allChecked;
}

async function refreshProviderStatus() {
  try {
    const status = await window.api.getProviderStatus();
    if (gistStatus) gistStatus.textContent = status.githubConfigured ? 'GitHub connected' : 'GitHub not configured';
    if (githubStatus) githubStatus.textContent = status.githubConfigured ? 'GitHub connected' : 'GitHub not configured';
    if (shareGistBtn) shareGistBtn.disabled = !status.githubConfigured;
  } catch (e) {
    if (gistStatus) gistStatus.textContent = '';
    if (githubStatus) githubStatus.textContent = '';
  }
}

searchBar.addEventListener('input', () => {
  const query = searchBar.value.trim().toLowerCase();
  if (query === '') {
    renderList(allSnippets);
  } else {
    const filtered = allSnippets.filter(item =>
      item.title.toLowerCase().includes(query) || item.body.toLowerCase().includes(query)
    );
    renderList(filtered);
  }
});

btnCodes.addEventListener('click', () => {
  setActiveButton(btnCodes);
  showPanel(panelCodes);
});

btnCap.addEventListener('click', () => {
  setActiveButton(btnCap);
  window.api.startCapture();
});

btnAi.addEventListener('click', () => {
  setActiveButton(btnAi);
  showPanel(panelAi);
});

btnSettings.addEventListener('click', () => {
  setActiveButton(btnSettings);
  showPanel(panelSettings);
  refreshProviderStatus().catch(() => {});
});

btnShare.addEventListener('click', () => {
  setActiveButton(btnShare);
  showPanel(panelShare);
  renderShareList('');
  refreshProviderStatus().catch(() => {});
});

const saveSettingsButton = document.getElementById('save-settings');
saveSettingsButton.addEventListener('click', async () => {
  const mode = modeSelect ? modeSelect.value : 'dark';
  const theme = themeSelect ? themeSelect.value : 'blue';
  try {
    const updated = await window.api.setSettings({ appearance: { mode, theme } });
    applyAppearance(updated);
    showToast('Settings saved', 'success');
  } catch (e) {
    console.error('Save settings failed', e);
  }
});

if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    try {
      const res = await window.api.exportSnippets();
      if (res?.success) {
        showToast(`Exported to ${res.filePath}`, 'success');
      } else {
        showToast('Export cancelled or failed', 'warn');
      }
    } catch (e) {
      console.error('Export failed', e);
      showToast('Export failed', 'error');
    }
  });
}

async function initUiState() {
  try {
    const state = await window.api.getUiState();
    if (state && typeof state.collapsed === 'boolean') {
      isCollapsed = state.collapsed;
      document.body.classList.toggle('collapsed', isCollapsed);
    }
  } catch {}
}

async function initSettings() {
  try {
    const s = await window.api.getSettings();
    applyAppearance(s);
    if (modeSelect) modeSelect.value = s.appearance?.mode || 'dark';
    if (themeSelect) themeSelect.value = s.appearance?.theme || 'blue';
    // If using system mode, react to changes
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener?.('change', () => {
        if ((currentSettings?.appearance?.mode || 'dark') === 'system') applyAppearance(currentSettings);
      });
    }
  } catch (e) {
    console.error('Init settings failed', e);
  }
}

async function init() {
  await initUiState();
  await initSettings();
  await loadSnippets();
}

init().catch(err => console.error(err));

// Reload snippets whenever the toolbar window regains focus (e.g., after saving from overlay)
window.addEventListener('focus', () => {
  loadSnippets().catch(err => console.error(err));
});

// Window control buttons
if (btnWinMin) {
  btnWinMin.addEventListener('click', () => window.api.windowMinimize());
}
if (btnWinMax) {
  btnWinMax.addEventListener('click', () => window.api.windowToggleMaximize());
}
if (btnWinClose) {
  btnWinClose.addEventListener('click', () => window.api.windowClose());
}

// Double-click the titlebar to toggle maximize
if (titlebarEl) {
  titlebarEl.addEventListener('dblclick', () => window.api.windowToggleMaximize());
}

// Sidebar double-click to collapse/expand content area and resize window
if (sidebar) {
  sidebar.addEventListener('dblclick', async () => {
    isCollapsed = !isCollapsed;
    document.body.classList.toggle('collapsed', isCollapsed);
    try {
      await window.api.windowSetCollapsed(isCollapsed);
    } catch (err) {
      console.error('Toggle collapsed failed', err);
    }
  });
}

// Share: events
if (shareSearch) {
  shareSearch.addEventListener('input', () => renderShareList(shareSearch.value.trim()));
}
if (shareSelectAll) {
  shareSelectAll.addEventListener('change', () => {
    const filtered = getFilteredSnippets(shareSearch ? shareSearch.value.trim() : '');
    if (shareSelectAll.checked) {
      filtered.forEach(s => shareSelected.add(s.id));
    } else {
      filtered.forEach(s => shareSelected.delete(s.id));
    }
    renderShareList(shareSearch ? shareSearch.value.trim() : '');
  });
}

async function doShareClipboard() {
  const selected = getSelectedSnippets();
  if (!selected.length) { showToast('Select at least one snippet', 'warn'); return; }
  try {
    const options = getShareOptions({ combine: true }); // force single content for clipboard
    const res = await window.api.shareFormat({ snippets: selected, options });
    if (!res?.success) throw new Error(res?.error || 'Format failed');
    const result = res.result || {};
    const text = result.content || Object.values(result.filesMap || {}).join('\n\n');
    await navigator.clipboard.writeText(text);
    showToast('Copied to clipboard', 'success');
  } catch (e) {
    console.error('Clipboard share failed', e);
    showToast('Clipboard copy failed', 'error');
  }
}

async function doShareFile() {
  const selected = getSelectedSnippets();
  if (!selected.length) { showToast('Select at least one snippet', 'warn'); return; }
  try {
    const options = getShareOptions();
    const res = await window.api.shareToFile({ snippets: selected, options });
    if (res?.canceled) return;
    if (!res?.success) throw new Error(res?.error || 'Save failed');
    if (res.filePath) showToast(`Saved to ${res.filePath}`, 'success');
    else if (res.directory) showToast(`Saved ${res.files?.length || 0} file(s) in ${res.directory}`, 'success');
  } catch (e) {
    console.error('File share failed', e);
    showToast('Save failed', 'error');
  }
}

async function doShareEmail() {
  const selected = getSelectedSnippets();
  if (!selected.length) { showToast('Select at least one snippet', 'warn'); return; }
  try {
    const options = getShareOptions({ combine: true });
    const res = await window.api.shareFormat({ snippets: selected, options });
    if (!res?.success) throw new Error(res?.error || 'Format failed');
    const result = res.result || {};
    const text = result.content || Object.values(result.filesMap || {}).join('\n\n');
    const subject = selected.length === 1 ? `Snippet: ${selected[0].title || 'Untitled'}` : `CodeCap snippets (${selected.length})`;
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    await window.api.openExternal(url);
    showToast('Email compose opened', 'success');
  } catch (e) {
    console.error('Email share failed', e);
    showToast('Email share failed', 'error');
  }
}

async function doShareGist() {
  const selected = getSelectedSnippets();
  if (!selected.length) { showToast('Select at least one snippet', 'warn'); return; }
  try {
    const status = await window.api.getProviderStatus();
    if (!status?.githubConfigured) {
      showToast('GitHub token not configured. Add it in Settings.', 'warn');
      return;
    }
    const options = getShareOptions();
    const description = gistDesc ? gistDesc.value.trim() : '';
    const isPublic = !!(gistPublic && gistPublic.checked);
    const res = await window.api.shareToGist({ snippets: selected, options, description, isPublic });
    if (!res?.success) throw new Error(res?.error || 'Gist failed');
    const url = res.url;
    if (url) {
      await navigator.clipboard.writeText(url);
      showToast(`Gist created: ${url} (URL copied)`, 'success', 3200);
    } else {
      showToast('Gist created', 'success');
    }
  } catch (e) {
    console.error('Gist share failed', e);
    showToast(`Gist failed: ${e.message || e}`, 'error');
  }
}

if (shareClipboardBtn) shareClipboardBtn.addEventListener('click', () => doShareClipboard());
if (shareFileBtn) shareFileBtn.addEventListener('click', () => doShareFile());
if (shareEmailBtn) shareEmailBtn.addEventListener('click', () => doShareEmail());
if (shareGistBtn) shareGistBtn.addEventListener('click', () => doShareGist());

// Provider settings: GitHub token save
if (saveGithubTokenBtn) {
  saveGithubTokenBtn.addEventListener('click', async () => {
    const token = (githubTokenInput && githubTokenInput.value.trim()) || '';
    if (!token) { showToast('Paste a GitHub token with gist scope', 'warn'); return; }
    try {
      await window.api.setProviderCredential('github', token);
      if (githubTokenInput) githubTokenInput.value = '';
      await refreshProviderStatus();
      showToast('GitHub token saved', 'success');
    } catch (e) {
      console.error('Save token failed', e);
      showToast('Failed to save GitHub token', 'error');
    }
  });
}