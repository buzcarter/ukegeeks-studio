/**
 * Songbooks and their songs: the songbook open in this window, a SongRepository
 * that reads and writes its songs through Tauri's fs plugin, and opening songs in
 * windows of their own (src-tauri/src/windows.rs).
 *
 * The open folder is remembered per window for this run of the app
 * (sessionStorage). File > Open Recent lists recent songs (src-tauri/src/recent.rs).
 */
import { ALL_EXTENSIONS, songExtensions } from './app-settings.js';
import { folderName, splitPath } from './paths.js';
import { SongRepository } from './songs.js';
import { errorMessage, invoke, onEvent, showProblem, tauri } from './tauri.js';

const FOLDER_KEY = 'studio.songbookFolder';
const SONGS_EVENT = 'studio://songbook-songs';

/** The songbook this window has open (or had, while Favorites or All Songs shows), or null. */
export function getFolder() {
  try {
    return sessionStorage.getItem(FOLDER_KEY);
  } catch {
    return null;
  }
}

/** Opens a songbook in this window; null closes it. */
export function setFolder(folder) {
  try {
    if (folder) sessionStorage.setItem(FOLDER_KEY, folder);
    else sessionStorage.removeItem(FOLDER_KEY);
  } catch {
    /* the list still works for this page; the editor will ask for the folder again */
  }
}

const repositories = new Map();

/**
 * The SongRepository for a folder. One is kept per folder and set of song types, so
 * its song list cache (a song is parsed again only when its file's size or date
 * changed) lasts between listings.
 */
export function openSongbook(folder, fileExtensions = songExtensions()) {
  const key = `${folder}\n${fileExtensions.join(' ')}`;
  if (!repositories.has(key)) {
    repositories.set(key, new SongRepository({
      songDirectory: folder,
      fileExtensions,
      maxFileSize: 512 * 1024,
      fs: tauri().fs,
    }));
  }
  return repositories.get(key);
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
    throw new Error(`Can't read the folder "${folderName(folder)}". Open it again. (${errorMessage(err)})`, { cause: err });
  }
}

/**
 * A songbook's songs changed (one was created, saved, renamed): tells every window,
 * this one included, so song lists read the folder again.
 */
export function notifySongsChanged(folder, filename = null) {
  return tauri().event.emit(SONGS_EVENT, { folder, filename })
    .catch((err) => console.warn('[studio] songbook songs event:', err));
}

/** Runs callback({ folder, filename }) when a songbook's songs changed, in any window. */
export function onSongsChanged(callback) {
  onEvent(SONGS_EVENT, (payload) => callback(payload || {}));
}

/**
 * Puts an open song at the top of File > Open Recent. single: opened on its own
 * (File > Open…), not from a songbook.
 */
export function addRecentSong(folder, filename, title, single = false) {
  return invoke('recent_add_song', { folder, filename, title, single })
    .catch((err) => console.warn('[studio] recent_add_song:', err));
}

/** The editor page for a song opened on its own, by its full path. */
export function fileUri(path) {
  return `editor.html?file=${encodeURIComponent(path)}`;
}

/**
 * Opens a song in its own window, or brings its window forward if it's open.
 * path: the song's file; url: its editor page.
 */
export async function openSongWindow(path, url) {
  try {
    await invoke('open_song_window', { path, url });
  } catch (err) {
    console.error(`[studio] opening ${path}:`, err);
    await showProblem('Open', `There was a problem opening "${splitPath(path).name}".`, err);
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
  return invoke('save_song_file', { path, text });
}
