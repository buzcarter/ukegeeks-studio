/**
 * The open songbook: which folder it is, and a SongRepository that reads and
 * writes its songs through Tauri's fs plugin. And the Library: the songbooks the
 * player added (src-tauri/src/library.rs), whose folders the app may read again at
 * every launch without the Open dialog.
 *
 * The open folder is remembered per window for this run of the app
 * (sessionStorage). File > Open Recent lists recent songs (src-tauri/src/recent.rs).
 */
import './songs.js';
import { askSongbookName } from './songbook-name.js';

const { SongRepository } = globalThis.studioSongs;

const FOLDER_KEY = 'studio.songbookFolder';

// Songs are "*.cpm" files, and new songs get ".cpm". Settings can list other song
// file types too (src-tauri/src/settings.rs); ".txt" also covers "*.cpm.txt", how the
// Songbook names its songs (Apache serves unknown file types badly).
export const SONG_EXTENSION = '.cpm';
export const TXT_SONG_EXTENSION = '.cpm.txt';
/** Every extension Settings offers, in its order. */
export const ALL_EXTENSIONS = ['.cpm', '.txt', '.cho', '.crd', '.chopro', '.chord', '.chordpro', '.pro'];

const SETTINGS_EVENT = 'studio://settings';
const LIBRARY_EVENT = 'studio://library';
const FAVORITES_EVENT = 'studio://favorites';
// before Settings existed, the song list's "Also list .cpm.txt songs" box (localStorage)
const OLD_INCLUDE_TXT_KEY = 'studio.includeCpmTxt';

let settings = {
  songExtensions: [SONG_EXTENSION],
  reopenLastSongbook: true,
  fileNaming: 'title-artist',
  renameWithTitle: true,
};

/**
 * A song's filename without its extension, from its title and artist, as Settings'
 * "File names" says: "Title - Artist" (the Songbook's, and the default), "Title", or
 * "Artist - Title". Just the title when there's no artist; '' with no title.
 */
export function songFileBase(title, artist, naming = settings.fileNaming) {
  const { scrubForTag } = globalThis.studioSongs;
  const t = scrubForTag(title);
  const a = scrubForTag(artist);
  if (!t) return '';
  if (!a || naming === 'title') return t;
  return naming === 'artist-title' ? `${a} - ${t}` : `${t} - ${a}`;
}

/**
 * Reads the app's settings (settings.json, kept by Rust); call before using
 * getSettings() or songExtensions(). Outside the app, the defaults.
 */
export async function loadSettings() {
  try {
    settings = await tauri().core.invoke('settings_get');
    await moveOldIncludeTxt();
  } catch (err) {
    console.warn('[studio] settings_get:', err);
  }
  return settings;
}

/** The old "Also list .cpm.txt songs" box becomes the ".txt" song type in Settings. */
async function moveOldIncludeTxt() {
  let old = null;
  try {
    old = localStorage.getItem(OLD_INCLUDE_TXT_KEY);
    localStorage.removeItem(OLD_INCLUDE_TXT_KEY);
  } catch {
    return;
  }
  if (old === '1' && !settings.songExtensions.includes('.txt')) {
    await saveSettings({ ...settings, songExtensions: [...settings.songExtensions, '.txt'] });
  }
}

export function getSettings() {
  return settings;
}

/** Saves new settings; resolves to them as kept. Every window hears about it. */
export async function saveSettings(next) {
  settings = await tauri().core.invoke('settings_set', { settings: next });
  return settings;
}

/** Runs callback(settings) whenever the settings change (in the Settings window). */
export function onSettingsChanged(callback) {
  tauri().event.listen(SETTINGS_EVENT, (event) => {
    settings = event.payload;
    callback(settings);
  }).catch((err) => console.error('[studio] settings events:', err));
}

/** The extensions for SongRepository: the chosen ones, plus ".cpm.txt" with ".txt". */
export function songExtensions(extensions = settings.songExtensions) {
  return extensions.includes('.txt') ? [...extensions, TXT_SONG_EXTENSION] : [...extensions];
}

export function tauri() {
  if (!window.__TAURI__) {
    throw new Error('These pages need the UkeGeeks Studio app (npm run dev); a browser has no file access.');
  }
  return window.__TAURI__;
}

export function getFolder() {
  try {
    return sessionStorage.getItem(FOLDER_KEY);
  } catch {
    return null;
  }
}

export function setFolder(folder) {
  try {
    sessionStorage.setItem(FOLDER_KEY, folder);
  } catch {
    /* the list still works for this page; the editor will ask for the folder again */
  }
}

/**
 * Shows the Open dialog for a songbook folder. Returns the chosen folder, or null if
 * cancelled. addSongbook() uses it.
 */
export async function pickFolder() {
  const folder = await tauri().dialog.open({
    title: 'Add Songbook to Library',
    directory: true,
    multiple: false,
    // the songs sit directly in the folder; no access to its subfolders is needed
    recursive: false,
  });
  return typeof folder === 'string' ? folder : null;
}

/**
 * The Library: { songbooks: [{ folder, name }, …] (in the order added), selected:
 * folder or null }. Empty outside the app.
 */
export async function getLibrary() {
  try {
    return await tauri().core.invoke('library_get');
  } catch (err) {
    console.warn('[studio] library_get:', err);
    return { songbooks: [], selected: null };
  }
}

/** The songbook for this folder in the Library ({ folder, name }), or undefined. */
export function findSongbook(library, folder) {
  return library.songbooks.find((s) => s.folder === folder);
}

/** A songbook's name: the one the player gave it, else its folder's name. */
export function songbookName(library, folder) {
  const songbook = findSongbook(library, folder);
  return songbook ? songbook.name : folderName(folder);
}

// Folder names that say nothing about the songs: suggest the parent folder's instead
const PLAIN_NAMES = ['songs', 'song', 'cpm', 'chordpro', 'chords', 'music', 'ukulele', 'uke', 'tabs', 'songbook', 'songbooks'];

/**
 * A name to suggest for a new songbook: the folder's, or, when that's a plain one
 * ("songs", "cpm") or another songbook has it, the parent folder's.
 */
export function suggestSongbookName(library, folder) {
  const name = folderName(folder);
  const parts = folder.replace(/[\/\\]+$/, '').split(/[\/\\]/).filter(Boolean);
  const parent = parts.length > 1 ? parts[parts.length - 2] : '';
  const taken = library.songbooks.some((s) => s.folder !== folder && s.name.toLowerCase() === name.toLowerCase());
  return parent && (taken || PLAIN_NAMES.includes(name.toLowerCase())) ? parent : name;
}

/**
 * Picks a folder, asks for the songbook's name, and adds it to the Library (selected,
 * and open in this window). Resolves to the folder, or null if cancelled.
 */
export async function addSongbook() {
  const folder = await pickFolder();
  if (!folder) return null;
  const library = await getLibrary();
  const existing = findSongbook(library, folder);
  const name = await askSongbookName({
    heading: existing ? 'Already in the Library' : 'Add Songbook',
    button: existing ? 'Rename' : 'Add',
    folder,
    name: existing ? existing.name : suggestSongbookName(library, folder),
  });
  if (!name) return null;
  await tauri().core.invoke('library_add', { folder, name });
  setFolder(folder);
  return folder;
}

/**
 * Right-click > Rename…: asks for a new name. Resolves to the Library, or null if
 * cancelled. The folder keeps its name on disk.
 */
export async function renameSongbook(library, folder) {
  const name = await askSongbookName({
    heading: 'Rename Songbook', button: 'Rename', folder, name: songbookName(library, folder),
  });
  if (!name) return null;
  return tauri().core.invoke('library_rename', { folder, name });
}

/** Takes a songbook out of the Library; its folder stays on disk. Resolves to the Library. */
export function removeSongbook(folder) {
  return tauri().core.invoke('library_remove', { folder });
}

/** Remembers the songbook (or FAVORITES_SELECTED) selected in the sidebar, for the next launch. */
export function selectSongbook(folder) {
  return tauri().core.invoke('library_select', { folder })
    .catch((err) => console.warn('[studio] library_select:', err));
}

/** Runs callback(library) whenever the Library changes, in any window. */
export function onLibraryChanged(callback) {
  tauri().event.listen(LIBRARY_EVENT, (event) => callback(event.payload))
    .catch((err) => console.error('[studio] Library events:', err));
}

// ---- Favorites (src-tauri/src/favorites.rs) ----

/** The Library's `selected` when the sidebar's Favorites was chosen last. */
export const FAVORITES_SELECTED = 'list:favorites';
const FAVORITES_ID = 'favorites';

/**
 * The Favorites: { lists: [{ id, name, songs: [{ folder, file }, …] }] }. One list
 * today, "Favorites"; kept as lists so set lists can come later. Empty outside the app.
 */
export async function getFavorites() {
  try {
    return await tauri().core.invoke('favorites_get');
  } catch (err) {
    console.warn('[studio] favorites_get:', err);
    return { lists: [] };
  }
}

/** The starred songs, [{ folder, file }, …], in the order starred. */
export function favoriteSongs(favorites) {
  const list = favorites.lists.find((l) => l.id === FAVORITES_ID);
  return list ? list.songs : [];
}

export function isStarred(favorites, folder, file) {
  return favoriteSongs(favorites).some((s) => s.folder === folder && s.file === file);
}

/** Stars or unstars a song of a songbook in the Library. Resolves to the Favorites. */
export function starSong(folder, file, starred) {
  return tauri().core.invoke('favorites_star', { folder, file, starred });
}

/** A song's file was renamed: its favorite follows (if it's starred). */
export function renameFavorite(folder, from, to) {
  return tauri().core.invoke('favorites_rename', { folder, from, to })
    .catch((err) => console.warn('[studio] favorites_rename:', err));
}

/** Runs callback(favorites) whenever a star changes, in any window. */
export function onFavoritesChanged(callback) {
  tauri().event.listen(FAVORITES_EVENT, (event) => callback(event.payload))
    .catch((err) => console.error('[studio] Favorites events:', err));
}

/**
 * Puts an open song at the top of File > Open Recent. single: opened on its own
 * (File > Open…), not from a songbook.
 */
export function addRecentSong(folder, filename, title, single = false) {
  return tauri().core.invoke('recent_add_song', { folder, filename, title, single })
    .catch((err) => console.warn('[studio] recent_add_song:', err));
}

/** The editor page for a song opened on its own, by its full path. */
export function fileUri(path) {
  return `editor.html?file=${encodeURIComponent(path)}`;
}

/**
 * Opens a song in its own window, or brings its window forward if it's open
 * (src-tauri/src/windows.rs). path: the song's file; url: its editor page.
 */
export async function openSongWindow(path, url) {
  try {
    await tauri().core.invoke('open_song_window', { path, url });
  } catch (err) {
    console.error(`[studio] opening ${path}:`, err);
    await tauri().dialog.message(`There was a problem opening "${splitPath(path).name}". (${err && err.message ? err.message : err})`, {
      title: 'Open', kind: 'error',
    });
  }
}

/** Opens a song of a songbook in its own window. */
export function openSongbookSong(folder, filename) {
  const songbook = openSongbook(folder);
  return openSongWindow(songbook.pathFor(filename), songbook.songUri(filename));
}

/** Opens a song on its own (File > Open…) in its own window. */
export function openSongFile(path) {
  return openSongWindow(path, fileUri(path));
}

/** A path split into its folder and filename. */
export function splitPath(path) {
  const i = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return { dir: path.slice(0, i), name: path.slice(i + 1) };
}

export function joinPath(folder, name) {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/';
  return folder.replace(/[\/\\]+$/, '') + sep + name;
}

/**
 * File > Open…: shows the Open dialog for one song file, of any song type (not
 * just the ones Settings lists). Resolves to its path, or null if cancelled. The
 * dialog gives the app access to that file only.
 */
export async function pickSongFile() {
  const path = await tauri().dialog.open({
    title: 'Open Song',
    multiple: false,
    directory: false,
    filters: [{ name: 'ChordPro songs', extensions: ALL_EXTENSIONS.map((ext) => ext.slice(1)) }],
  });
  return typeof path === 'string' ? path : null;
}

/** Writes a song opened on its own, or saved somewhere new (temp file + rename, in Rust). */
export function saveSongFile(path, text) {
  return tauri().core.invoke('save_song_file', { path, text });
}

/** The folder's last part, for display ("cpm" for ".../UkeGeeks/cpm"). */
export function folderName(folder) {
  return folder.replace(/[\/\\]+$/, '').split(/[\/\\]/).pop() || folder;
}

export function openSongbook(folder, fileExtensions = songExtensions()) {
  return new SongRepository({
    songDirectory: folder,
    fileExtensions,
    maxFileSize: 512 * 1024,
    fs: tauri().fs,
  });
}

/**
 * Throws a readable error if the folder can't be read, for example after the app
 * restarted (Tauri's access to the folder lasts one run). SongRepository itself
 * treats an unreadable folder as an empty one.
 */
export async function checkAccess(folder) {
  try {
    await tauri().fs.readDir(folder);
  } catch (err) {
    throw new Error(`Can't read the folder "${folderName(folder)}". Open it again. (${err && err.message ? err.message : err})`);
  }
}

// From the Songbook's server/lib/html.js (f63b6fe), unchanged.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// "&" that does NOT already start an entity like &amp; &copy; &#39; &#x2665;
const BARE_AMP_OR_SPECIAL = /&(?!#\d+;|#x[0-9a-f]+;|[a-z][a-z0-9]*;)|[<>"']/gi;

/**
 * Escapes <, >, quotes and bare &, but leaves existing entities alone (like PHP's
 * htmlspecialchars with double_encode=false). ChordPro files in this project
 * legitimately contain entities ("Lyrics &amp; Music &copy; 1933"); an entity
 * can't open a tag or leave a quoted attribute, so this is still XSS-safe.
 */
export function escapeHtml(value) {
  return String(value).replace(BARE_AMP_OR_SPECIAL, (c) => ESCAPES[c]);
}
