/**
 * Favorites: the songs the player starred, from any songbook of the Library
 * (src-tauri/src/favorites.rs).
 */
import { invoke, onEvent } from './tauri.js';

const FAVORITES_EVENT = 'studio://favorites';
const FAVORITES_ID = 'favorites';

/**
 * The Favorites: { lists: [{ id, name, songs: [{ folder, file }, …] }] }. One list
 * today, "Favorites"; kept as lists so set lists can come later. Empty outside the app.
 */
export async function getFavorites() {
  try {
    return await invoke('favorites_get');
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
  return invoke('favorites_star', { folder, file, starred });
}

/** A song's file was renamed: its favorite follows (if it's starred). */
export function renameFavorite(folder, from, to) {
  return invoke('favorites_rename', { folder, from, to })
    .catch((err) => console.warn('[studio] favorites_rename:', err));
}

/** Runs callback(favorites) whenever a star changes, in any window. */
export function onFavoritesChanged(callback) {
  onEvent(FAVORITES_EVENT, callback);
}

/** What a star button says: its ☆/★ and its label, for a tooltip and screen readers. */
export function starLook(starred) {
  return { symbol: starred ? '★' : '☆', label: starred ? 'Remove from Favorites' : 'Add to Favorites' };
}

/** Shows a star button (a <button aria-pressed>) as starred or not. */
export function showStar(button, starred) {
  const { symbol, label } = starLook(starred);
  button.textContent = symbol;
  button.title = label;
  button.setAttribute('aria-label', label);
  button.setAttribute('aria-pressed', String(starred));
}

/** Is this star button showing as starred? */
export const starIsOn = (button) => button.getAttribute('aria-pressed') === 'true';
