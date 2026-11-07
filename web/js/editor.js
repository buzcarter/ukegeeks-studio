/**
 * The editor page: editor.html?song=<file> opens that song from the open songbook;
 * editor.html?file=<path> opens a song on its own (File > Open…), with access to
 * just that file. One song per page (the editor finds its parts by id), so opening another song
 * means loading this page again.
 *
 * Save writes the file (temp file + rename: SongRepository.update in a songbook,
 * the save_song_file command for a song on its own). The song is
 * "dirty" while the Edit Song text differs from what was last opened or saved: the
 * window title says "Edited", and going back to the list, closing the window,
 * File > Open Songbook… and Quit ask first.
 *
 * File > Save As… writes the song under a new name and switches to it: in the
 * songbook folder, as a song of the songbook; anywhere else, as a song on its own
 * (the Save dialog gives access to that one file).
 */
import {
  addRecentSong, escapeHtml, fileUri, getFolder, loadSettings, openRecent, openSongbook, pickSongFile,
  saveSongFile, SONG_EXTENSION, splitPath, tauri,
} from './songbook.js';
import { onMenu, quitApp } from './menu.js';

const { parseSong } = globalThis.studioSongs;
const container = document.getElementById('songEditor');

const cleanPath = (path) => path.replace(/[\/\\]+$/, '').normalize('NFC');

// Until a song is open (or if it can't be), File > Open…, Open Songbook…, Open Recent
// and View > Show Song List just go; main() replaces these with ones that ask about
// unsaved changes.
onMenu('open-file', async () => {
  const path = await pickSongFile();
  if (path) location.href = fileUri(path);
});
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

/**
 * The song this page edits: { song, filename, folder, path, write(text) }, plus
 * songbook (a SongRepository) when it's from the open songbook, or { problem }.
 */
async function openSong(params) {
  const file = params.get('file');
  if (file) {
    // on its own: the app may read and write this file, not its folder
    const { dir, name } = splitPath(file);
    let text = null;
    try {
      text = await tauri().fs.readTextFile(file);
    } catch (err) {
      console.error(`[studio] reading ${file}:`, err);
    }
    const song = parseSong(text);
    if (!song.isOK) return { problem: `Can't open the song "${file}".` };
    return { song, filename: name, folder: dir, path: file, write: (t) => saveSongFile(file, t) };
  }

  const folder = getFolder();
  if (!folder) return { problem: 'No songbook is open.' };
  await loadSettings(); // which song file types the songbook has
  const songbook = openSongbook(folder);
  const id = params.get('song');
  const { filename, song } = await songbook.load(id);
  if (!filename || !song.isOK) return { problem: `Can't open the song "${id || ''}".` };
  return {
    song, filename, folder, songbook,
    path: songbook.pathFor(filename),
    write: (t) => songbook.update(filename, t),
  };
}

async function main() {
  const opened = await openSong(new URLSearchParams(location.search));
  if (opened.problem) {
    showProblem(opened.problem);
    return;
  }
  const { song, filename, folder, songbook, path } = opened;

  let savedText = null;
  const songName = song.title || filename;
  addRecentSong(folder, filename, songName, !songbook);

  const editor = ugsEditorPlus.songAmatic.mount(container, {
    song: song.body,
    // @ukegeeks/ace-chordpro-extension's dist/, copied in by scripts/vendor.js
    aceUrl: 'vendor/ace/',
    save: async (text) => {
      try {
        await opened.write(text);
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
    const newPath = await tauri().dialog.save({
      title: 'Save As',
      defaultPath: path,
      filters: [{ name: 'ChordPro song', extensions: [SONG_EXTENSION.slice(1)] }],
    });
    if (typeof newPath !== 'string') return;
    if (cleanPath(newPath) === cleanPath(path)) {
      save();
      return;
    }
    const { dir, name } = splitPath(newPath);
    const text = currentText();
    try {
      if (!songbook || cleanPath(dir) !== cleanPath(folder)) {
        // a song on its own: the dialog gave access to this one file
        await saveSongFile(newPath, text);
        location.href = fileUri(newPath);
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
      console.error(`[studio] saving as ${newPath}:`, err);
      await tauri().dialog.message(`There was a problem saving "${name}". (${err && err.message ? err.message : err})`, {
        title: 'Save As', kind: 'error',
      });
      return;
    }
    // now editing the new file; the old one keeps its last saved text
    location.href = songbook.songUri(name);
  });

  // File > Open… (Cmd+O): a song on its own
  onMenu('open-file', async () => {
    const newPath = await pickSongFile();
    if (!newPath) return;
    if (isDirty() && !(await confirmDiscard('Open another song'))) return;
    location.href = fileUri(newPath);
  });

  // File > Open Songbook… (Shift+Cmd+O): back to the list, which shows the picker.
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
