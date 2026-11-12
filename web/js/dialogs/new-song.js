/**
 * File > New Song… (Cmd+N), and the song list's New Song…: asks for a title and
 * artist, then creates "Title - Artist.cpm" (or as Settings names files) in the open
 * songbook (SongRepository.create: a unique name, never overwrites) and opens it in
 * its own window.
 *
 * With no songbook open, Add Songbook to Library comes first.
 */
import { getSettings, loadSettings, SONG_EXTENSION, songFileBase } from '../lib/app-settings.js';
import { addSongbook, getLibrary, songbookName } from '../lib/library.js';
import { joinPath } from '../lib/paths.js';
import { getFolder, notifySongsChanged, openSongbook, openSongbookSong, openSongFile } from '../lib/songbook.js';
import { foldName, scrubForFilename } from '../lib/songs.js';
import { errorMessage, showProblem } from '../lib/tauri.js';
import { makeDialog, showFormDialog } from './form-dialog.js';

/** Shows the New Song dialog. Resolves to { title, artist, baseName }, or null if cancelled. */
function askTitleAndArtist(inSongbook, songbook) {
  const dialog = makeDialog(`
    <form>
      <h2 class="woodBar">New Song</h2>
      <div class="studioDialogBody woodChip">
      <p class="studioDialogNote">In the songbook <strong class="studioDialogSongbook"></strong></p>
      <label>Title <input name="title" class="woodInput" required autocomplete="off" spellcheck="false" /></label>
      <label>Artist <input name="artist" class="woodInput" autocomplete="off" spellcheck="false" placeholder="optional" /></label>
      <label>File name <input name="baseName" class="woodInput" required autocomplete="off" spellcheck="false" /></label>
      <p class="studioDialogFilename">Will be saved as <strong class="studioDialogFileValue"></strong></p>
      <p class="studioDialogHint" role="status" aria-live="polite"></p>
      <div class="studioDialogButtons">
        <button type="button" class="studioDialogCancel woodBtn">Cancel</button>
        <button class="studioDialogDefault woodBtn orange">Create</button>
      </div>
      </div>
    </form>`);
  dialog.querySelector('.studioDialogSongbook').textContent = inSongbook;
  const form = dialog.querySelector('form');
  const titleEl = form.elements.title;
  const artistEl = form.elements.artist;
  const baseNameEl = form.elements.baseName;
  const fileValueEl = form.querySelector('.studioDialogFileValue');
  const hintEl = form.querySelector('.studioDialogHint');
  let manualBaseName = false;
  let refreshTimer = null;
  let refreshRun = 0;

  const setHint = (text, warning = false) => {
    hintEl.textContent = text;
    hintEl.classList.toggle('isWarning', warning);
  };
  /** The file name the song will get, and a warning when the one asked for is taken. */
  const refreshFilename = async (fromSongFields) => {
    const run = ++refreshRun;
    const autoBase = songFileBase(titleEl.value.trim(), artistEl.value.trim()) || 'untitled';
    if (fromSongFields && (!manualBaseName || !baseNameEl.value.trim())) {
      baseNameEl.value = autoBase;
    }
    const requestedBase = scrubForFilename(baseNameEl.value.trim() || autoBase) || 'untitled';
    const requested = `${requestedBase}${SONG_EXTENSION}`;
    let suggested = requested;
    let problem = null;
    try {
      suggested = await songbook.availableFilename(requestedBase, SONG_EXTENSION);
    } catch (err) {
      problem = err;
    }
    if (run !== refreshRun) return; // typed again meanwhile
    fileValueEl.textContent = suggested;
    if (problem) setHint(`Couldn’t check filename availability. (${errorMessage(problem)})`, true);
    else if (foldName(suggested) !== foldName(requested)) setHint(`That file already exists. Suggested: ${suggested}`, true);
    else setHint('');
  };
  const scheduleRefresh = (fromSongFields) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshFilename(fromSongFields), 120);
  };

  titleEl.addEventListener('input', () => scheduleRefresh(true));
  artistEl.addEventListener('input', () => scheduleRefresh(true));
  baseNameEl.addEventListener('input', () => {
    manualBaseName = true;
    scheduleRefresh(false);
  });
  scheduleRefresh(true);

  return showFormDialog(dialog, () => {
    const title = titleEl.value.trim();
    const artist = artistEl.value.trim();
    const baseName = scrubForFilename(baseNameEl.value.trim()) || songFileBase(title, artist) || 'untitled';
    return title ? { title, artist, baseName } : null;
  }).finally(() => clearTimeout(refreshTimer));
}

/**
 * Asks for a title and artist, creates the song and opens it in its own window. In
 * the songbook open in this window, or the one given (the sidebar's right-click > New
 * Song…).
 */
export async function newSong({ folder: inFolder } = {}) {
  let folder = inFolder || getFolder();
  if (!folder) {
    folder = await addSongbook();
    if (!folder) return;
  }
  await loadSettings();
  // always ".cpm", whatever song types Settings lists; named as Settings says
  const songbook = openSongbook(folder, [SONG_EXTENSION]);
  const answer = await askTitleAndArtist(songbookName(await getLibrary(), folder), songbook);
  if (!answer) return;

  let filename;
  try {
    filename = await songbook.create(answer.title, answer.artist, answer.baseName);
  } catch (err) {
    console.error('[studio] new song:', err);
    await showProblem('New Song', `There was a problem creating "${answer.title}".`, err);
    return;
  }
  notifySongsChanged(folder, filename);
  // If Settings doesn't list .cpm songs, open it on its own rather than "not found"
  await (getSettings().songExtensions.includes(SONG_EXTENSION)
    ? openSongbookSong(folder, filename)
    : openSongFile(joinPath(folder, filename)));
}
