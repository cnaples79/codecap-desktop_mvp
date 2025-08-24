// Overlay script for CodeCap capture
let isSelecting = false;
let startX = 0;
let startY = 0;
const selectionEl = document.getElementById('selection');
const modalEl = document.getElementById('modal');
const loadingEl = document.getElementById('loading');
const titleInput = document.getElementById('capture-title');
const categorySelect = document.getElementById('capture-category');
const bodyTextarea = document.getElementById('capture-body');
const aiToggle = document.getElementById('ai-toggle');
const aiSummaryDiv = document.getElementById('ai-summary');
const btnCancel = document.getElementById('btn-cancel');
const btnSave = document.getElementById('btn-save');

function resetOverlay(hideWindow = true) {
  isSelecting = false;
  selectionEl.style.display = 'none';
  modalEl.style.display = 'none';
  loadingEl.style.display = 'none';
  titleInput.value = '';
  bodyTextarea.value = '';
  aiSummaryDiv.textContent = '';
  aiToggle.checked = true;
  document.body.style.cursor = 'crosshair';
  modalEl._aiResult = undefined;

  // Notify main process to hide the overlay window. Without this, the
  // transparent capture window may remain visible or intercept clicks after
  // closing the modal. We intentionally call this after resetting local
  // state so that the overlay can be reused on the next capture.
  if (hideWindow && window.api && typeof window.api.closeOverlay === 'function') {
    window.api.closeOverlay();
  }
}

document.addEventListener('mousedown', (ev) => {
  if (ev.target.closest('#modal')) return;
  isSelecting = true;
  startX = ev.pageX;
  startY = ev.pageY;
  selectionEl.style.left = startX + 'px';
  selectionEl.style.top = startY + 'px';
  selectionEl.style.width = '0px';
  selectionEl.style.height = '0px';
  selectionEl.style.display = 'block';
});

document.addEventListener('mousemove', (ev) => {
  if (!isSelecting) return;
  const currentX = ev.pageX;
  const currentY = ev.pageY;
  const rectLeft = Math.min(currentX, startX);
  const rectTop = Math.min(currentY, startY);
  const rectWidth = Math.abs(currentX - startX);
  const rectHeight = Math.abs(currentY - startY);
  selectionEl.style.left = rectLeft + 'px';
  selectionEl.style.top = rectTop + 'px';
  selectionEl.style.width = rectWidth + 'px';
  selectionEl.style.height = rectHeight + 'px';
});

document.addEventListener('mouseup', async (ev) => {
  if (!isSelecting) return;
  isSelecting = false;
  const endX = ev.pageX;
  const endY = ev.pageY;
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);
  selectionEl.style.display = 'none';
  if (width < 5 || height < 5) {
    resetOverlay();
    return;
  }
  loadingEl.style.display = 'block';
  document.body.style.cursor = 'wait';
  try {
    const result = await window.api.captureRegion({
      x,
      y,
      width,
      height,
      viewport: { w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio }
    });
    loadingEl.style.display = 'none';
    document.body.style.cursor = 'default';
    if (result.error) {
      alert('Capture failed: ' + result.error);
      resetOverlay();
      return;
    }
    titleInput.value = '';
    bodyTextarea.value = result.text;
    aiSummaryDiv.textContent = '';
    modalEl.style.display = 'flex';
    if (aiToggle.checked) {
      aiSummaryDiv.textContent = 'Generating summary…';
      try {
        const aiResult = await window.api.aiProcess(result.text);
        aiSummaryDiv.textContent = 'Summary: ' + aiResult.summary + '\nTags: ' + aiResult.tags.join(', ');
        modalEl._aiResult = aiResult;
      } catch (err) {
        aiSummaryDiv.textContent = '';
      }
    }
  } catch (err) {
    loadingEl.style.display = 'none';
    document.body.style.cursor = 'default';
    alert('Capture failed: ' + (err.message || err));
    resetOverlay();
  }
});

btnCancel.addEventListener('click', () => {
  resetOverlay();
  window.api.showToolbar();
});

btnSave.addEventListener('click', async () => {
  const title = titleInput.value.trim() || 'Untitled';
  const body = bodyTextarea.value.trim();
  const category = categorySelect.value;
  let aiSummary;
  let aiTags;
  const aiResult = modalEl._aiResult;
  if (aiToggle.checked && aiResult) {
    aiSummary = aiResult.summary;
    aiTags = aiResult.tags;
  }
  const snippet = {
    title,
    body,
    category,
    tags: [],
    aiSummary,
    aiTags
  };
  await window.api.saveSnippet(snippet);
  resetOverlay();
  window.api.showToolbar();
});

window.api.onOverlayStart(() => {
  // Prepare UI for a new capture without hiding the overlay window
  resetOverlay(false);
});