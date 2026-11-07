/**
 * The open songbook: which folder it is, and a SongRepository that reads and
 * writes its songs through Tauri's fs plugin.
 *
 * The folder is remembered for this run of the app only (sessionStorage), the
 * same span as the access Tauri gives to a folder picked in the Open dialog.
 * Remembering it across launches comes later (Phase 5).
 */
import './songs.js';

const { SongRepository } = globalThis.studioSongs;

const FOLDER_KEY = 'studio.songbookFolder';
const INCLUDE_TXT_KEY = 'studio.includeCpmTxt';

// Songs are "*.cpm" files. "*.cpm.txt" is how the Songbook names them (Apache serves
// unknown file types badly); a setting lists those too.
export const SONG_EXTENSION = '.cpm';
export const TXT_SONG_EXTENSION = '.cpm.txt';

/** Setting: also list "*.cpm.txt" songs. Kept by the app across launches (localStorage). */
export function includeCpmTxt() {
  try {
    return localStorage.getItem(INCLUDE_TXT_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIncludeCpmTxt(on) {
  try {
    localStorage.setItem(INCLUDE_TXT_KEY, on ? '1' : '0');
  } catch {
    /* the setting lasts for this page only */
  }
}

export function songExtensions() {
  return includeCpmTxt() ? [SONG_EXTENSION, TXT_SONG_EXTENSION] : [SONG_EXTENSION];
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

function setFolder(folder) {
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
