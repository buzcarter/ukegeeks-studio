/**
 * The song list: Open Songbook… picks a folder; its songs are listed sorted by
 * title, like the Songbook ("The Rose" sorts as "Rose, The"). Each one opens in
 * the editor page.
 */
import { checkAccess, escapeHtml, folderName, getFolder, openSongbook, pickFolder } from './songbook.js';

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');

function showStatus(html, isError = false) {
  statusEl.innerHTML = html;
  statusEl.classList.toggle('isError', isError);
}

async function showSongbook(folder) {
  listEl.innerHTML = '';
  showStatus(`Reading <strong>${escapeHtml(folderName(folder))}</strong>…`);
  try {
    await checkAccess(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message), true);
    return;
  }
  const songs = await openSongbook(folder).getSongList();
  const count = songs.length === 1 ? '1 song' : `${songs.length} songs`;
  showStatus(`<strong title="${escapeHtml(folder)}">${escapeHtml(folderName(folder))}</strong>: ${count}`);
  if (!songs.length) {
    showStatus(`<strong title="${escapeHtml(folder)}">${escapeHtml(folderName(folder))}</strong> has no songs (<code>*.cpm.txt</code> files).`);
    return;
  }
  listEl.innerHTML = songs
    .map((song) => {
      const details = [song.artist, song.subtitle].filter(Boolean).map(escapeHtml).join(' · ');
      return `<li><a href="${escapeHtml(song.uri)}">`
        + `<span class="songTitle">${escapeHtml(song.title)}</span>`
        + (details ? ` <span class="songDetails">${details}</span>` : '')
        + '</a></li>';
    })
    .join('');
}

document.getElementById('openSongbook').addEventListener('click', async () => {
  try {
    const folder = await pickFolder();
    if (folder) await showSongbook(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
});

const folder = getFolder();
if (folder) {
  showSongbook(folder);
}
