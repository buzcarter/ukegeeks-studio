/**
 * The editor page, one per song window (src-tauri/src/windows.rs):
 * editor.html?folder=<folder>&song=<file> opens that song from a songbook;
 * editor.html?file=<path> opens a song on its own (File > Open…), with access to
 * just that file. One song per page (the editor finds its parts by id), so other
 * songs open in windows of their own.
 *
 * Save writes the file (temp file + rename: SongRepository.update in a songbook,
 * the save_song_file command for a song on its own). The song is
 * "dirty" while its text (the editor's getSong()) differs from what was last opened or saved: the
 * window title says "Edited", and closing the window or quitting asks first: Save &
 * Close / Save & Quit, Discard Edits, or Continue Editing.
 *
 * File > Save As… writes the song under a new name and switches this window to it: in the
 * songbook folder, as a song of the songbook; anywhere else, as a song on its own
 * (the Save dialog gives access to that one file).
 *
 * The ☆ in the corner bar stars the song (Favorites, src-tauri/src/favorites.rs):
 * only a song of a songbook in the Library. When Save renames its file, the
 * favorite follows; Save As makes a new song, which starts unstarred.
 */
import { newSong } from './dialogs/new-song.js';
import { getSettings, loadSettings, SONG_EXTENSION, songFileBase } from './lib/app-settings.js';
import { getFavorites, isStarred, onFavoritesChanged, renameFavorite, showStar, starIsOn, starSong } from './lib/favorites.js';
import { escapeText } from './lib/html.js';
import { findSongbook, getLibrary, onLibraryChanged, songbookName } from './lib/library.js';
import { cancelQuit, onMenu, quitApp } from './lib/menu.js';
import { cleanPath, folderName, splitPath } from './lib/paths.js';
import {
  addRecentSong, fileUri, getFolder, notifySongsChanged, openSongbook, openSongFile, pickSongFile, saveSongFile, setFolder,
} from './lib/songbook.js';
import { parseSong } from './lib/songs.js';
import { errorMessage, invoke, showProblem, tauri } from './lib/tauri.js';

const container = document.getElementById('songEditor');

// File > Open… (Cmd+O) and New Song… (Cmd+N) open other windows; this song stays.
onMenu('open-file', async () => {
  const path = await pickSongFile();
  if (path) await openSongFile(path);
});
onMenu('new-song', () => newSong());

/**
 * Where the song lives, for the corner bar and Save's message: its songbook's name
 * from the Library (else the folder's name), or for a song on its own its folder's.
 */
let placeName = '';
// the window title shows the place too, so it is told when the place is known or renamed
let onPlaceChange = () => {};
async function showPlace(folder, inSongbook) {
  placeName = inSongbook ? songbookName(await getLibrary(), folder) : folderName(folder);
  const place = document.getElementById('songPlace');
  place.textContent = `${inSongbook ? 'Songbook' : 'Folder'}: ${placeName}`;
  place.title = folder;
  onPlaceChange();
}

/**
 * The ☆/★ in the corner bar, for a song of a songbook in the Library. getFilename():
 * the song's file now (Save can rename it).
 */
function setUpStar(folder, getFilename) {
  const star = document.getElementById('songStar');
  let favorites = { lists: [] };
  let inLibrary = false;
  const show = () => {
    star.hidden = !inLibrary;
    showStar(star, isStarred(favorites, folder, getFilename()));
  };
  star.addEventListener('click', async () => {
    try {
      favorites = await starSong(folder, getFilename(), !starIsOn(star));
      show();
    } catch (err) {
      await showProblem('Favorites', 'There was a problem changing Favorites.', err);
    }
  });
  onFavoritesChanged((next) => {
    favorites = next;
    show();
  });
  // the songbook can leave the Library (or come back) while the song is open
  const checkLibrary = (library) => {
    inLibrary = !!findSongbook(library, folder);
    show();
  };
  onLibraryChanged(checkLibrary);
  Promise.all([getFavorites(), getLibrary()]).then(([f, library]) => {
    favorites = f;
    checkLibrary(library);
  });
  return show;
}

function showPageProblem(message) {
  container.innerHTML = `<p class="studioProblem">${escapeText(message)}</p>`;
}

/** Tells Rust which file this window holds, so opening it again brings this window forward. */
function tellPath(path) {
  return invoke('song_window_path', { path })
    .catch((err) => console.warn('[studio] song_window_path:', err));
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

  // a new window doesn't know the open songbook: it comes in the address
  const folder = params.get('folder') || getFolder();
  if (!folder) return { problem: 'No songbook is open.' };
  setFolder(folder); // File > New Song… in this window adds to this songbook
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
    showPageProblem(opened.problem);
    return;
  }
  const { song, folder, songbook } = opened;
  // the file can be renamed on save (Settings: rename when the title or artist changes)
  let { filename, path } = opened;
  let named = { title: song.title, artist: song.artist };

  let savedText = null;
  let songName = song.title || filename;
  addRecentSong(folder, filename, songName, !songbook);
  tellPath(path);
  showPlace(folder, !!songbook);
  // renamed in the Library meanwhile
  if (songbook) onLibraryChanged(() => showPlace(folder, true));
  const showStar = songbook ? setUpStar(folder, () => filename) : () => {};

  /**
   * Writes the song. In a songbook, when its title or artist changed since it was
   * opened or last saved, the file gets the name Settings says ("Title - Artist.cpm")
   * and the page follows it. A song on its own keeps its name: the app may write only
   * that file.
   */
  async function write(text) {
    const parsed = parseSong(text);
    const retitled = parsed.title !== named.title || parsed.artist !== named.artist;
    if (!songbook) {
      await opened.write(text);
    } else if (retitled && getSettings().renameWithTitle) {
      const newName = await songbook.updateAs(filename, songFileBase(parsed.title, parsed.artist), text);
      if (newName !== filename) {
        renameFavorite(folder, filename, newName); // a starred song stays starred
        filename = newName;
        path = songbook.pathFor(newName);
        history.replaceState(null, '', songbook.songUri(newName));
        tellPath(path);
        showStar();
      }
    } else {
      await songbook.update(filename, text);
    }
    named = { title: parsed.title, artist: parsed.artist };
    songName = parsed.title || filename;
    addRecentSong(folder, filename, songName, !songbook);
    // song lists show the title, artist and file: they read the songbook again
    if (songbook) notifySongsChanged(folder, filename);
  }

  const editor = ugsEditorPlus.songAmatic.mount(container, {
    song: song.body,
    // @ukegeeks/ace-chordpro-extension's dist/, copied in by scripts/vendor.js
    aceUrl: 'vendor/ace/',
    // typing (the Edit Song box or Fullscreen), Transpose, Reformat, the Chord Builder
    onChange: () => showTitle(),
    save: async (text) => {
      const before = filename;
      try {
        await write(text);
      } catch (err) {
        console.error(`[studio] saving ${filename}:`, err);
        throw err; // the editor shows its "problem saving" alert
      }
      savedText = text;
      showTitle(); // the title or artist may have changed too
      // say where, not just the name: "Saved Beta.cpm in My Songs"
      return `${filename === before ? 'Saved' : 'Saved as'} ${filename} in ${placeName || folderName(folder)}`;
    },
  });

  // Compare with the editor's own text as opened, not the file's: a text box turns
  // Windows line endings into "\n", so the two can differ untouched.
  savedText = editor.getSong();
  // (getSong() is Fullscreen's text while Fullscreen is open)
  const isDirty = () => editor.getSong() !== savedText;

  // The window title: "Title - Artist (Songbook)", plus "— Edited" while there are unsaved
  // changes. Checked when the editor says the song changed (onChange), after a save, and
  // when the songbook is known or renamed.
  let shownTitle = null;
  function showTitle() {
    const artist = named.artist ? ` - ${named.artist}` : '';
    const place = placeName ? ` (${placeName})` : '';
    const title = `${songName}${artist}${place}${isDirty() ? ' — Edited' : ''}`;
    if (title === shownTitle) return;
    shownTitle = title;
    document.title = `${title} · UkeGeeks Studio`;
    tauri().window.getCurrentWindow().setTitle(title).catch((err) => console.warn('[studio] setTitle:', err));
  }
  onPlaceChange = showTitle;
  showTitle();

  window.studioEditor = editor; // studioEditor.getSong() in the Web Inspector console
  window.studioIsDirty = isDirty;

  /**
   * Before closing the window or quitting: with unsaved changes, asks "Save & …" /
   * Discard Edits / Continue Editing. Resolves true to go on (saved or discarded),
   * false to stay. Esc is Continue Editing. If saving fails, says so and stays.
   * @param {string} saveLabel the first button, for what comes next ("Save & Quit")
   */
  async function readyToLeave(saveLabel) {
    if (!isDirty()) return true;
    const DISCARD = 'Discard Edits';
    const STAY = 'Continue Editing';
    const choice = await tauri().dialog.message(`Do you want to save the changes you made to "${songName}"?`, {
      title: 'Unsaved changes',
      kind: 'warning',
      buttons: { yes: saveLabel, no: DISCARD, cancel: STAY },
    });
    if (choice === DISCARD) return true;
    if (choice !== saveLabel) return false;
    const text = editor.getSong();
    try {
      await write(text);
      savedText = text;
      return true;
    } catch (err) {
      console.error(`[studio] saving ${filename}:`, err);
      await showProblem('Unsaved changes', `There was a problem saving "${filename}", so it's still open.`, err);
      return false;
    }
  }

  // File > Save (Cmd+S): what the editor's Save button does, so its "Saved …" message
  // and "problem saving" alert show as usual. In Fullscreen it saves Fullscreen's text.
  onMenu('save', () => editor.save());

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
      await editor.save();
      return;
    }
    const { dir, name } = splitPath(newPath);
    const text = editor.getSong();
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
      await showProblem('Save As', `There was a problem saving "${name}".`, err);
      return;
    }
    // now editing the new file; the old one keeps its last saved text
    await notifySongsChanged(folder, name);
    location.href = songbook.songUri(name);
  });

  // File > Print… (Cmd+P): the song as shown, with the editor's print styles
  // (ugsEditorPlus.print.css). On a Mac the print_page command opens the system Print
  // dialog with sensible margins; elsewhere window.print() does.
  onMenu('print', () => invoke('print_page').catch(() => window.print()));

  // Quit (Cmd+Q, or Quit in the Dock): Rust asks each song window in turn
  onMenu('quit', async () => {
    if (await readyToLeave('Save & Quit')) await quitApp();
    else await cancelQuit();
  });

  // Closing the window (red button, Cmd+W). Once this listener exists, Tauri closes
  // the window only through destroy(), which it calls itself unless we prevent it.
  const appWindow = tauri().window.getCurrentWindow();
  await appWindow.onCloseRequested(async (event) => {
    if (!isDirty()) return;
    event.preventDefault();
    if (await readyToLeave('Save & Close')) await appWindow.destroy();
  });
}

main().catch((err) => {
  console.error('[studio]', err);
  showPageProblem(errorMessage(err));
});
