// Toolbar script for CodeCap

// Elements
const btnCodes = document.getElementById('btn-codes');
const btnCap = document.getElementById('btn-cap');
const btnAi = document.getElementById('btn-ai');
const btnSettings = document.getElementById('btn-settings');

const panelCodes = document.getElementById('panel-codes');
const panelAi = document.getElementById('panel-ai');
const panelSettings = document.getElementById('panel-settings');

const codesList = document.getElementById('codes-list');
const searchBar = document.getElementById('search-bar');

let allSnippets = [];

function setActiveButton(button) {
  [btnCodes, btnCap, btnAi, btnSettings].forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
}

function showPanel(panel) {
  [panelCodes, panelAi, panelSettings].forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
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

    li.appendChild(titleEl);
    li.appendChild(previewEl);
    li.appendChild(codeEl);

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
    codesList.appendChild(li);
  });
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

const saveSettingsButton = document.getElementById('save-settings');
saveSettingsButton.addEventListener('click', () => {
  const langInput = document.getElementById('ocr-languages');
  const languages = langInput.value.trim() || 'eng';
  console.log('Selected OCR languages:', languages);
  alert('Settings saved');
});

loadSnippets().catch(err => console.error(err));

// Reload snippets whenever the toolbar window regains focus (e.g., after saving from overlay)
window.addEventListener('focus', () => {
  loadSnippets().catch(err => console.error(err));
});