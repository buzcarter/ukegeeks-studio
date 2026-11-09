/**
 * File > New Song… (Cmd+N), and the song list's New Song… button: asks for a title
 * and artist, then creates "Title - Artist.cpm" (or as Settings names files) in the open songbook
 * (SongRepository.create: a unique name, never overwrites) and opens it in its own window.
 *
 * With no songbook open, Add Songbook to Library comes first. The dialog here is the
 * page's own (<dialog>): the dialog plugin has no text input.
 */
import {
  addSongbook, escapeHtml, getFolder, getLibrary, getSettings, joinPath, loadSettings, openSongbook,
  notifySongbookSongsChanged, openSongbookSong, openSongFile, SONG_EXTENSION, songbookName, songFileBase, tauri,
} from './songbook.js';

const { scrubForFilename } = globalThis.studioSongs;

function foldName(name) {
  return name.normalize('NFC').toLowerCase();
}

/** Shows the New Song dialog. Resolves to { title, artist, baseName }, or null if cancelled. */
function askTitleAndArtist(songbookName, songbook) {
  const dialog = document.createElement('dialog');
  dialog.className = 'studioDialog';
  dialog.innerHTML = `
    <form>
      <h2 class="woodBar">New Song</h2>
      <div class="studioDialogBody woodChip">
      <p class="studioDialogNote">In the songbook <strong>${escapeHtml(songbookName)}</strong></p>
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
    </form>`;
  document.body.append(dialog);
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
  const scheduleRefresh = (fromSongFields = false) => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => refreshFilename(fromSongFields), 120);
  };
  const refreshFilename = async (fromSongFields = false) => {
    const run = ++refreshRun;
    const title = titleEl.value.trim();
    const artist = artistEl.value.trim();
    const autoBase = songFileBase(title, artist) || 'untitled';
    if (fromSongFields && (!manualBaseName || !baseNameEl.value.trim())) {
      baseNameEl.value = autoBase;
    }

    const typedBase = baseNameEl.value.trim();
    const requestedBase = scrubForFilename(typedBase || autoBase) || 'untitled';
    const requestedFilename = `${requestedBase}${SONG_EXTENSION}`;
    let suggestedFilename = requestedFilename;
    try {
      suggestedFilename = await songbook.availableFilename(requestedBase, SONG_EXTENSION);
    } catch (err) {
      if (run !== refreshRun) return;
      fileValueEl.textContent = requestedFilename;
      setHint(`Couldn’t check filename availability. (${err && err.message ? err.message : err})`, true);
      return;
    }
    if (run !== refreshRun) return;

    fileValueEl.textContent = suggestedFilename;
    const hasCollision = foldName(suggestedFilename) !== foldName(requestedFilename);
    if (hasCollision) {
      setHint(`That file already exists. Suggested: ${suggestedFilename}`, true);
    } else {
      setHint('');
    }
  };

  return new Promise((resolve) => {
    // Answers straight from submit / Esc / Cancel, not from the dialog's "close"
    // event, which a page in the background may get late.
    const finish = (create) => {
      clearTimeout(refreshTimer);
      const title = titleEl.value.trim();
      const artist = artistEl.value.trim();
      const baseName = scrubForFilename(baseNameEl.value.trim()) || songFileBase(title, artist) || 'untitled';
      dialog.close();
      dialog.remove();
      resolve(create && title ? { title, artist, baseName } : null);
    };
    // Return submits (Cancel is a plain button, so Create is the form's default)
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    titleEl.addEventListener('input', () => scheduleRefresh(true));
    artistEl.addEventListener('input', () => scheduleRefresh(true));
    baseNameEl.addEventListener('input', () => {
      manualBaseName = true;
      scheduleRefresh(false);
    });
    dialog.addEventListener('cancel', (event) => { // Esc
      event.preventDefault();
      finish(false);
    });
    dialog.querySelector('.studioDialogCancel').addEventListener('click', () => finish(false));
    dialog.showModal();
    scheduleRefresh(true);
  });
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
  const songbook = openSongbook(folder, [SONG_EXTENSION]);
  const answer = await askTitleAndArtist(songbookName(await getLibrary(), folder), songbook);
  if (!answer) return;

  let filename;
  try {
    // always ".cpm", whatever song types Settings lists; named as Settings says
    filename = await songbook.create(answer.title, answer.artist, answer.baseName);
    notifySongbookSongsChanged(folder, filename);
  } catch (err) {
    console.error('[studio] new song:', err);
    await tauri().dialog.message(`There was a problem creating "${answer.title}". (${err && err.message ? err.message : err})`, {
      title: 'New Song', kind: 'error',
    });
    return;
  }
  // If Settings doesn't list .cpm songs, open it on its own rather than "not found"
  await (getSettings().songExtensions.includes(SONG_EXTENSION)
    ? openSongbookSong(folder, filename)
    : openSongFile(joinPath(folder, filename)));
}
