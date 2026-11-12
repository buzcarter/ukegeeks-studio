/**
 * The pages' own dialogs with a text box (New Song, Songbook Name): the dialog
 * plugin has none. A <dialog class="studioDialog"> holding one <form>, with a
 * ".studioDialogCancel" button.
 */

/** A <dialog> from its HTML, added to the page (not shown yet). */
export function makeDialog(html) {
  const dialog = document.createElement('dialog');
  dialog.className = 'studioDialog';
  dialog.innerHTML = html;
  document.body.append(dialog);
  return dialog;
}

/**
 * Shows the dialog and resolves to answer(form) when the form is submitted (Return,
 * or its default button), or to null for Cancel or Esc; then removes the dialog.
 * It answers straight from submit / Esc / Cancel, not from the dialog's "close"
 * event, which a page in the background may get late or not at all.
 */
export function showFormDialog(dialog, answer) {
  const form = dialog.querySelector('form');
  return new Promise((resolve) => {
    const finish = (ok) => {
      const value = ok ? answer(form) : null;
      dialog.close();
      dialog.remove();
      resolve(value);
    };
    // Cancel is a plain button, so the other one is the form's default
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
