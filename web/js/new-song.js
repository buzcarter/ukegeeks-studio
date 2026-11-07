/**
 * File > New Song… (Cmd+N), and the song list's New Song… button: asks for a title
 * and artist, then creates "Title - Artist.cpm" in the open songbook
 * (SongRepository.create: a unique name, never overwrites) and opens it.
 *
 * With no songbook open, the Open Songbook dialog comes first. The dialog here is the
 * page's own (<dialog>): the dialog plugin has no text input.
 */
import {
  escapeHtml, fileUri, folderName, getFolder, getSettings, joinPath, loadSettings, openSongbook,
  pickFolder, SONG_EXTENSION, tauri,
} from './songbook.js';

/** Shows the New Song dialog. Resolves to { title, artist }, or null if cancelled. */
function askTitleAndArtist(songbookName) {
  const dialog = document.createElement('dialog');
  dialog.className = 'studioDialog';
  dialog.innerHTML = `
    <form>
      <h2>New Song</h2>
      <p class="studioDialogNote">In the songbook <strong>${escapeHtml(songbookName)}</strong></p>
      <label>Title <input name="title" required autocomplete="off" spellcheck="false" /></label>
      <label>Artist <input name="artist" autocomplete="off" spellcheck="false" placeholder="optional" /></label>
      <div class="studioDialogButtons">
        <button type="button" class="studioDialogCancel">Cancel</button>
        <button class="studioDialogDefault">Create</button>
      </div>
    </form>`;
  document.body.append(dialog);
  const form = dialog.querySelector('form');
  return new Promise((resolve) => {
    // Answers straight from submit / Esc / Cancel, not from the dialog's "close"
    // event, which a page in the background may get late.
    const finish = (create) => {
      const title = form.elements.title.value.trim();
      const artist = form.elements.artist.value.trim();
      dialog.close();
      dialog.remove();
      resolve(create && title ? { title, artist } : null);
    };
    // Return submits (Cancel is a plain button, so Create is the form's default)
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    dialog.addEventListener('cancel', (event) => { // Esc
      event.preventDefault();
      finish(false);
    });
    dialog.querySelector('.studioDialogCancel').addEventListener('click', () => finish(false));
    dialog.showModal();
  });
}

/**
 * Asks for a title and artist and creates the song. confirm(), if given, runs after
 * the dialog and before anything is created; returning false stops (the editor asks
 * about unsaved changes there).
 */
export async function newSong({ confirm } = {}) {
  let folder = getFolder();
  if (!folder) {
    folder = await pickFolder();
    if (!folder) return;
  }
  const answer = await askTitleAndArtist(folderName(folder));
  if (!answer) return;
  if (confirm && !(await confirm())) return;

  let filename;
  try {
    // always ".cpm", whatever song types Settings lists
    filename = await openSongbook(folder, [SONG_EXTENSION]).create(answer.title, answer.artist);
  } catch (err) {
    console.error('[studio] new song:', err);
    await tauri().dialog.message(`There was a problem creating "${answer.title}". (${err && err.message ? err.message : err})`, {
      title: 'New Song', kind: 'error',
    });
    return;
  }
  await loadSettings();
  // If Settings doesn't list .cpm songs, open it on its own rather than "not found"
  location.href = getSettings().songExtensions.includes(SONG_EXTENSION)
    ? openSongbook(folder).songUri(filename)
    : fileUri(joinPath(folder, filename));
}
