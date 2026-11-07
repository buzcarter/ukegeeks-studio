/**
 * The editor page: editor.html?song=<file> opens that song from the open songbook.
 * One song per page (the editor finds its parts by id), so opening another song
 * means loading this page again.
 *
 * Save writes the file (temp file + rename, see SongRepository.update). The song is
 * "dirty" while the Edit Song text differs from what was last opened or saved: the
 * window title says "Edited", and going back to the list or closing the window asks
 * first.
 */
import { escapeHtml, getFolder, openSongbook, tauri } from './songbook.js';

const container = document.getElementById('songEditor');

function showProblem(message) {
  container.innerHTML = `<p class="studioProblem">${escapeHtml(message)} <a href="index.html">Back to the songs</a></p>`;
}

/** Asks whether to throw away unsaved changes. Resolves true to discard. */
function confirmDiscard(action) {
  return tauri().dialog.ask(`This song has changes that aren't saved. ${action} anyway?`, {
    title: 'Unsaved changes',
    kind: 'warning',
    okLabel: 'Discard changes',
    cancelLabel: 'Keep editing',
  });
}

async function main() {
  const folder = getFolder();
  if (!folder) {
    showProblem('No songbook is open.');
    return;
  }
  const songbook = openSongbook(folder);
  const id = new URLSearchParams(location.search).get('song');
  const { filename, song } = await songbook.load(id);
  if (!filename || !song.isOK) {
    showProblem(`Can't open the song "${id || ''}".`);
    return;
  }

  let savedText = null;
  const songName = song.title || filename;

  const editor = ugsEditorPlus.songAmatic.mount(container, {
    song: song.body,
    // @ukegeeks/ace-chordpro-extension's dist/, copied in by scripts/vendor.js
    aceUrl: 'vendor/ace/',
    save: async (text) => {
      try {
        await songbook.update(filename, text);
      } catch (err) {
        console.error(`[studio] saving ${filename}:`, err);
        throw err; // the editor shows its "problem saving" alert
      }
      savedText = text;
      showDirty();
      return `Saved ${filename}`;
    },
  });

  // Compare with the editor's own text as opened, not the file's: the Edit Song box
  // decodes HTML entities ("&amp;" shows as "&"), so the two can differ untouched.
  savedText = editor.getSong();

  // While Fullscreen is open, getSong() still returns the Edit Song box, which gets
  // Ace's text only when Fullscreen closes; read Ace's text instead. (Better fixed in
  // @ukegeeks/song-editor: getSong() could return Ace's text during Fullscreen.)
  function currentText() {
    const aceEl = document.querySelector('.ace_editor'); // Fullscreen is added to <body>, outside container
    const ace = aceEl && aceEl.getClientRects().length && aceEl.env && aceEl.env.editor;
    return ace ? ace.getValue() : editor.getSong();
  }
  const isDirty = () => currentText() !== savedText;

  // The window title shows the song, plus "Edited" while there are unsaved changes.
  // The editor has no change event, so check after typing and clicks, and on a timer
  // for edits the page doesn't see as events (Fullscreen, the Chord Builder).
  let shownDirty = null;
  function showDirty() {
    const dirty = isDirty();
    if (dirty === shownDirty) return;
    shownDirty = dirty;
    const title = `${songName}${dirty ? ' — Edited' : ''}`;
    document.title = `${title} · UkeGeeks Studio`;
    tauri().window.getCurrentWindow().setTitle(title).catch((err) => console.warn('[studio] setTitle:', err));
  }
  showDirty();
  for (const type of ['input', 'keyup', 'click']) document.addEventListener(type, showDirty);
  setInterval(showDirty, 1000);

  window.studioEditor = editor; // studioEditor.getSong() in the Web Inspector console
  window.studioIsDirty = isDirty;

  document.getElementById('backToSongs').addEventListener('click', async (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    if (await confirmDiscard('Go back to the songs')) location.href = 'index.html';
  });

  // Closing the window (red button, Cmd+W). Once this listener exists, Tauri closes
  // the window only through destroy(), which it calls itself unless we prevent it.
  const appWindow = tauri().window.getCurrentWindow();
  await appWindow.onCloseRequested(async (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    if (await confirmDiscard('Close the window')) await appWindow.destroy();
  });
}

main().catch((err) => {
  console.error('[studio]', err);
  showProblem(err.message || String(err));
});
