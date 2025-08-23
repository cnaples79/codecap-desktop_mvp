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

let allSnippets = [];
let isCollapsed = false;
let currentSettings = null;

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
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.title = 'Edit';
    editBtn.textContent = '✎';
    const delBtn = document.createElement('button');
    delBtn.className = 'action-btn';
    delBtn.title = 'Delete';
    delBtn.textContent = '🗑';
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
});

btnShare.addEventListener('click', () => {
  setActiveButton(btnShare);
  showPanel(panelShare);
});

const saveSettingsButton = document.getElementById('save-settings');
saveSettingsButton.addEventListener('click', async () => {
  const mode = modeSelect ? modeSelect.value : 'dark';
  const theme = themeSelect ? themeSelect.value : 'blue';
  try {
    const updated = await window.api.setSettings({ appearance: { mode, theme } });
    applyAppearance(updated);
    alert('Settings saved');
  } catch (e) {
    console.error('Save settings failed', e);
  }
});

if (exportBtn) {
  exportBtn.addEventListener('click', async () => {
    try {
      const res = await window.api.exportSnippets();
      if (res?.success) {
        alert(`Exported to ${res.filePath}`);
      } else {
        alert('Export cancelled or failed');
      }
    } catch (e) {
      console.error('Export failed', e);
      alert('Export failed');
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