/**
 * The open songbook: which folder it is, and a SongRepository that reads and
 * writes its songs through Tauri's fs plugin.
 *
 * The open folder is remembered for this run of the app (sessionStorage). Across
 * launches, the app keeps a list of recent songbooks and songs (File > Open
 * Recent, src-tauri/src/recent.rs), whose folders it may read again without the
 * Open dialog.
 */
import './songs.js';

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
// before Settings existed, the song list's "Also list .cpm.txt songs" box (localStorage)
const OLD_INCLUDE_TXT_KEY = 'studio.includeCpmTxt';

let settings = { songExtensions: [SONG_EXTENSION], reopenLastSongbook: true };

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

/** Shows the Open dialog. Returns the chosen folder, or null if cancelled. */
export async function pickFolder() {
  const folder = await tauri().dialog.open({
    title: 'Open Songbook',
    directory: true,
    multiple: false,
    // the songs sit directly in the folder; no access to its subfolders is needed
    recursive: false,
  });
  if (typeof folder !== 'string') return null;
  setFolder(folder);
  return folder;
}

/**
 * The recent lists: { songbooks: [folder, …], songs: [{ folder, filename, title }, …] },
 * most recent first. Empty outside the app.
 */
export async function recentList() {
  try {
    return await tauri().core.invoke('recent_list');
  } catch (err) {
    console.warn('[studio] recent_list:', err);
    return { songbooks: [], songs: [] };
  }
}

/** Puts an open songbook at the top of File > Open Recent. */
export function addRecentSongbook(folder) {
  return tauri().core.invoke('recent_add_songbook', { folder })
    .catch((err) => console.warn('[studio] recent_add_songbook:', err));
}

/** Puts an open song at the top of File > Open Recent. */
export function addRecentSong(folder, filename, title) {
  return tauri().core.invoke('recent_add_song', { folder, filename, title })
    .catch((err) => console.warn('[studio] recent_add_song:', err));
}

/** Opens an item from File > Open Recent: { folder, song } (song is a filename, or null). */
export function openRecent({ folder, song }) {
  setFolder(folder);
  location.href = song ? `editor.html?song=${encodeURIComponent(song)}` : 'index.html';
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
