document.addEventListener('DOMContentLoaded', () => {
  const originalEl = document.getElementById('overlay-original');
  const textEl = document.getElementById('overlay-text');
  const hideBtn = document.getElementById('overlay-hide');

  if (hideBtn) {
    hideBtn.addEventListener('click', () => {
      window.htAPI?.toggleOverlay();
    });
  }

  // 监听来自主进程或工作台的实时翻译更新
  window.htAPI?.onTranslationUpdate((data) => {
    if (!data) return;
    if (data.original !== undefined) {
      originalEl.textContent = data.original || '...';
    }
    if (data.text !== undefined) {
      textEl.textContent = data.text || '';
    }
  });
});
