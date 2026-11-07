/**
 * The Songbook Name dialog: when a folder is added to the Library, and for
 * right-click > Rename… in the sidebar. Folders are often just "songs" or "cpm", so
 * the player names each songbook. The page's own <dialog>, like New Song (the dialog
 * plugin has no text input).
 */

/**
 * Shows the dialog. Resolves to the name (trimmed, maybe ''), or null if cancelled.
 * @param {{ heading: string, button: string, folder: string, name: string }} options
 */
export function askSongbookName({ heading, button, folder, name }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'studioDialog';
  dialog.innerHTML = `
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
    </form>`;
  // set as text, not HTML: names and paths can hold anything
  dialog.querySelector('h2').textContent = heading;
  dialog.querySelector('.studioDialogDefault').textContent = button;
  const folderEl = dialog.querySelector('.songbookFolder');
  folderEl.textContent = folder;
  folderEl.title = folder;
  const form = dialog.querySelector('form');
  form.elements.name.value = name;
  document.body.append(dialog);
  return new Promise((resolve) => {
    // answers straight from submit / Esc / Cancel, as in New Song
    const finish = (ok) => {
      const value = form.elements.name.value.trim().replace(/\s+/g, ' ');
      dialog.close();
      dialog.remove();
      resolve(ok && value ? value : null);
    };
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      finish(true);
    });
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      finish(false);
    });
    dialog.querySelector('.studioDialogCancel').addEventListener('click', () => finish(false));
    dialog.showModal();
    form.elements.name.select();
  });
}
