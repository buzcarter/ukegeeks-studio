/**
 * The Library: the songbooks the player added (src-tauri/src/library.rs), whose
 * folders the app may read again at every launch without the Open dialog.
 */
import { askSongbookName } from '../dialogs/songbook-name.js';
import { folderName, parentName } from './paths.js';
import { setFolder } from './songbook.js';
import { invoke, onEvent, tauri } from './tauri.js';

const LIBRARY_EVENT = 'studio://library';

/** The Library's `selected` when the sidebar's Favorites was chosen last. */
export const FAVORITES_SELECTED = 'list:favorites';
/** The Library's `selected` when the sidebar's All Songs was chosen last. */
export const ALL_SELECTED = 'list:all';

/**
 * Shows the Open dialog for a songbook folder. Returns the chosen folder, or null if
 * cancelled. The dialog gives the app access to the folder for this run.
 */
export async function pickFolder(title = 'Add Songbook to Library') {
  const folder = await tauri().dialog.open({
    title,
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
    return await invoke('library_get');
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
  const parent = parentName(folder);
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
  await invoke('library_add', { folder, name });
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
  return invoke('library_rename', { folder, name });
}

/** Takes a songbook out of the Library; its folder stays on disk. Resolves to the Library. */
export function removeSongbook(folder) {
  return invoke('library_remove', { folder });
}

/**
 * Right-click > Change Folder…: picks the songbook's new folder (it moved, or its
 * drive has another name now); the name and favorites stay. Resolves to the Library
 * and the new folder, { library, folder }, or null if cancelled.
 */
export async function changeSongbookFolder(folder) {
  const to = await pickFolder('Change Songbook Folder');
  if (!to || to === folder) return null;
  const library = await invoke('library_change_folder', { folder, to });
  return { library, folder: to };
}

/** Right-click > Open Folder: shows the songbook's folder in Finder (Explorer). */
export function revealSongbook(folder) {
  return invoke('library_reveal', { folder });
}

/** Remembers what's selected in the sidebar (a songbook's folder, FAVORITES_SELECTED or ALL_SELECTED), for the next launch. */
export function selectSongbook(folder) {
  return invoke('library_select', { folder })
    .catch((err) => console.warn('[studio] library_select:', err));
}

/** Runs callback(library) whenever the Library changes, in any window. */
export function onLibraryChanged(callback) {
  onEvent(LIBRARY_EVENT, callback);
}
