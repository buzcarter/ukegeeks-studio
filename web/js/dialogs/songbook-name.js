/**
 * The Songbook Name dialog: when a folder is added to the Library, and for
 * right-click > Rename… in the sidebar. Folders are often just "songs" or "cpm", so
 * the player names each songbook.
 */
import { makeDialog, showFormDialog } from './form-dialog.js';

/**
 * Shows the dialog. Resolves to the name (trimmed), or null if cancelled or empty.
 * @param {{ heading: string, button: string, folder: string, name: string }} options
 */
export function askSongbookName({ heading, button, folder, name }) {
  const dialog = makeDialog(`
    <form>
      <h2 class="woodBar"></h2>
      <div class="studioDialogBody woodChip">
      <p class="studioDialogNote">The folder <strong class="songbookFolder"></strong></p>
      <label>Name <input name="name" class="woodInput" required autocomplete="off" spellcheck="false" maxlength="80" /></label>
      <div class="studioDialogButtons">
        <button type="button" class="studioDialogCancel woodBtn">Cancel</button>
        <button class="studioDialogDefault woodBtn orange"></button>
      </div>
      </div>
    </form>`);
  // set as text, not HTML: names and paths can hold anything
  dialog.querySelector('h2').textContent = heading;
  dialog.querySelector('.studioDialogDefault').textContent = button;
  const folderEl = dialog.querySelector('.songbookFolder');
  folderEl.textContent = folder;
  folderEl.title = folder;
  const nameEl = dialog.querySelector('form').elements.name;
  nameEl.value = name;
  const answered = showFormDialog(dialog, () => nameEl.value.trim().replace(/\s+/g, ' ') || null);
  nameEl.select();
  return answered;
}
