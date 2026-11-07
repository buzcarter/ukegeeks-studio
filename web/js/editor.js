/**
 * The editor page: editor.html?song=<name> opens that song from the open songbook.
 * One song per page (the editor finds its parts by id), so opening another song
 * means loading this page again.
 *
 * Save writes the file (temp file + rename, see SongRepository.update). Going back
 * to the list with unsaved changes asks first.
 */
import { escapeHtml, getFolder, openSongbook, tauri } from './songbook.js';

const container = document.getElementById('songEditor');

function showProblem(message) {
  container.innerHTML = `<p class="studioProblem">${escapeHtml(message)} <a href="index.html">Back to the songs</a></p>`;
}

async function main() {
  const folder = getFolder();
  if (!folder) {
    showProblem('No songbook is open.');
    return;
  }
  const songbook = openSongbook(folder);
  const id = new URLSearchParams(location.search).get('song');
  const { filename, song } = await songbook.load(id);
  if (!filename || !song.isOK) {
    showProblem(`Can't open the song "${id || ''}".`);
    return;
  }

  let savedText = song.body;
  document.title = `${song.title || filename} · UkeGeeks Studio`;

  const editor = ugsEditorPlus.songAmatic.mount(container, {
    song: song.body,
    // @ukegeeks/ace-chordpro-extension's dist/, copied in by scripts/vendor.js
    aceUrl: 'vendor/ace/',
    save: async (text) => {
      try {
        await songbook.update(filename, text);
      } catch (err) {
        console.error(`[studio] saving ${filename}:`, err);
        throw err; // the editor shows its "problem saving" alert
      }
      savedText = text;
      return `Saved ${filename}`;
    },
  });
  window.studioEditor = editor; // studioEditor.getSong() in the Web Inspector console

  document.getElementById('backToSongs').addEventListener('click', async (event) => {
    if (editor.getSong() === savedText) return;
    event.preventDefault();
    const leave = await tauri().dialog.ask('This song has changes that aren\'t saved. Go back to the songs anyway?', {
      title: 'Unsaved changes',
      kind: 'warning',
      okLabel: 'Discard changes',
      cancelLabel: 'Keep editing',
    });
    if (leave) location.href = 'index.html';
  });
}

main().catch((err) => {
  console.error('[studio]', err);
  showProblem(err.message || String(err));
});
