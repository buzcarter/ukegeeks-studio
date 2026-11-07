// Shows whether Tauri's globals (core, dialog, fs) reached the page.
// Temporary: replaced by the song list in a later step.
(() => {
  const t = window.__TAURI__ || {};
  const found = ['core', 'dialog', 'fs'].map((name) => `${name}: ${t[name] ? 'yes' : 'no'}`);
  document.getElementById('tauriCheck').textContent = `Tauri APIs: ${found.join(', ')}`;
})();
