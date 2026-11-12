/**
 * The app's settings (settings.json, kept by Rust: src-tauri/src/settings.rs), and
 * what follows from them: which song files a songbook lists and how new files are named.
 */
import { scrubForTag } from './songs.js';
import { invoke, onEvent } from './tauri.js';

// Songs are "*.cpm" files, and new songs get ".cpm". Settings can list other song
// file types too; ".txt" also covers "*.cpm.txt", how the Songbook names its songs
// (Apache serves unknown file types badly).
export const SONG_EXTENSION = '.cpm';
export const TXT_SONG_EXTENSION = '.cpm.txt';
/** Every extension Settings offers, in its order. */
export const ALL_EXTENSIONS = ['.cpm', '.txt', '.cho', '.crd', '.chopro', '.chord', '.chordpro', '.pro'];

const SETTINGS_EVENT = 'studio://settings';
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
  const t = scrubForTag(title);
  const a = scrubForTag(artist);
  if (!t) return '';
  if (!a || naming === 'title') return t;
  return naming === 'artist-title' ? `${a} - ${t}` : `${t} - ${a}`;
}

/**
 * Reads the app's settings; call before using getSettings() or songExtensions().
 * Outside the app, the defaults.
 */
export async function loadSettings() {
  try {
    settings = await invoke('settings_get');
    await moveOldIncludeTxt();
  } catch (err) {
    console.warn('[studio] settings_get:', err);
  }
  return settings;
}

/** The old "Also list .cpm.txt songs" box becomes the ".txt" song type in Settings. */
async function moveOldIncludeTxt() {
  let old;
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
  settings = await invoke('settings_set', { settings: next });
  return settings;
}

/** Runs callback(settings) whenever the settings change (in the Settings window). */
export function onSettingsChanged(callback) {
  onEvent(SETTINGS_EVENT, (next) => {
    settings = next;
    callback(settings);
  });
}

/** The extensions for SongRepository: the chosen ones, plus ".cpm.txt" with ".txt". */
export function songExtensions(extensions = settings.songExtensions) {
  return extensions.includes('.txt') ? [...extensions, TXT_SONG_EXTENSION] : [...extensions];
}
