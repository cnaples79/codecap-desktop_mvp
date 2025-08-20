const emblemEl = document.getElementById('emblem');
if (emblemEl) {
  emblemEl.addEventListener('click', () => {
    window.api.showToolbar();
  });
}