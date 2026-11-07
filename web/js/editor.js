/**
 * The editor page: editor.html?song=<file> opens that song from the open songbook.
 * One song per page (the editor finds its parts by id), so opening another song
 * means loading this page again.
 *
 * Save writes the file (temp file + rename, see SongRepository.update). The song is
 * "dirty" while the Edit Song text differs from what was last opened or saved: the
 * window title says "Edited", and going back to the list, closing the window,
 * File > Open Songbook… and Quit ask first.
 *
 * File > Save As… writes the song under a new name: in the songbook folder, the
 * editor switches to the new file; anywhere else, it's a copy (the app has no access
 * to that folder beyond the one file).
 */
import {
  addRecentSong, escapeHtml, getFolder, loadSettings, openRecent, openSongbook, SONG_EXTENSION, tauri,
} from './songbook.js';
import { onMenu, quitApp } from './menu.js';

const container = document.getElementById('songEditor');
const statusEl = document.getElementById('studioStatus');

/** A short message in the bar at the bottom right ("Saved a copy to …"). */
function showStatus(message) {
  statusEl.textContent = message;
  statusEl.title = message;
  statusEl.hidden = !message;
}

/** A path from the Save dialog, split into its folder and filename. */
function splitPath(path) {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

const cleanPath = (path) => path.replace(/[\/\\]+$/, '').normalize('NFC');

// Until a song is open (or if it can't be), File > Open Songbook…, Open Recent and
// View > Show Song List just go; main() replaces these with ones that ask about unsaved changes.
onMenu('open-songbook', () => { location.href = 'index.html?open=1'; });
onMenu('open-recent', openRecent);
onMenu('show-song-list', () => { location.href = 'index.html'; });

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
  await loadSettings(); // which song file types the songbook has
  const songbook = openSongbook(folder);
  const id = new URLSearchParams(location.search).get('song');
  const { filename, song } = await songbook.load(id);
  if (!filename || !song.isOK) {
    showProblem(`Can't open the song "${id || ''}".`);
    return;
  }

  let savedText = null;
  const songName = song.title || filename;
  addRecentSong(folder, filename, songName);

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

  // File > Save (Cmd+S): the editor's own Save button, so its "Saved …" message and
  // "problem saving" alert show as usual. The button saves the Edit Song box, which
  // gets Fullscreen's text only when Fullscreen closes: copy it in first.
  function save() {
    const box = document.getElementById('chordProSource');
    const button = document.getElementById('saveBtn');
    if (!box || !button) return;
    box.value = currentText();
    button.click();
  }
  onMenu('save', save);

  // File > Save As… (Shift+Cmd+S). The native dialog asks before replacing a file;
  // nothing else is overwritten.
  onMenu('save-as', async () => {
    const path = await tauri().dialog.save({
      title: 'Save As',
      defaultPath: songbook.pathFor(filename),
      filters: [{ name: 'ChordPro song', extensions: [SONG_EXTENSION.slice(1)] }],
    });
    if (typeof path !== 'string') return;
    const { dir, name } = splitPath(path);
    const text = currentText();
    try {
      if (cleanPath(dir) !== cleanPath(folder)) {
        // elsewhere: the dialog gave access to this one file, so write it directly
        await tauri().fs.writeTextFile(path, text);
        showStatus(`Saved a copy to ${path}`);
        return;
      }
      if (name.normalize('NFC') === filename.normalize('NFC')) {
        save();
        return;
      }
      if (!songbook.isSongFilename(name)) {
        await tauri().dialog.message(`Songs are "${SONG_EXTENSION}" files, so "${name}" wouldn't be listed. Choose Save As again and use a name that ends in "${SONG_EXTENSION}".`, {
          title: 'Save As', kind: 'warning',
        });
        return;
      }
      await songbook.update(name, text); // temp file + rename, like Save
    } catch (err) {
      console.error(`[studio] saving as ${path}:`, err);
      await tauri().dialog.message(`There was a problem saving "${name}". (${err && err.message ? err.message : err})`, {
        title: 'Save As', kind: 'error',
      });
      return;
    }
    // now editing the new file; the old one keeps its last saved text
    location.href = songbook.songUri(name);
  });

  // File > Open Songbook… (Cmd+O): back to the list, which shows the picker.
  onMenu('open-songbook', async () => {
    if (isDirty() && !(await confirmDiscard('Open another songbook'))) return;
    location.href = 'index.html?open=1';
  });

  // File > Open Recent
  onMenu('open-recent', async (item) => {
    if (isDirty() && !(await confirmDiscard(item.song ? 'Open another song' : 'Open another songbook'))) return;
    openRecent(item);
  });

  // Quit (Cmd+Q, or Quit in the Dock)
  onMenu('quit', async () => {
    if (isDirty() && !(await confirmDiscard('Quit'))) return;
    await quitApp();
  });

  document.getElementById('backToSongs').addEventListener('click', async (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    if (await confirmDiscard('Go back to the songs')) location.href = 'index.html';
  });

  // View > Show Song List (Cmd+L): the same as "← Songs"
  onMenu('show-song-list', async () => {
    if (isDirty() && !(await confirmDiscard('Go back to the songs'))) return;
    location.href = 'index.html';
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
