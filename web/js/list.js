/**
 * The song list: Open Songbook… picks a folder; its songs are listed sorted by
 * title, like the Songbook ("The Rose" sorts as "Rose, The"). Each one opens in
 * the editor page.
 */
import {
  checkAccess, escapeHtml, folderName, getFolder, includeCpmTxt, openSongbook, pickFolder,
  setIncludeCpmTxt, TXT_SONG_EXTENSION,
} from './songbook.js';

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');
const includeTxtBox = document.getElementById('includeCpmTxt');

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
  const name = `<strong title="${escapeHtml(folder)}">${escapeHtml(folderName(folder))}</strong>`;
  const count = songs.length === 1 ? '1 song' : `${songs.length} songs`;
  showStatus(`${name}: ${count}`);
  if (!songs.length) {
    // a Songbook folder: all ".cpm.txt", which aren't listed unless the setting is on
    const txtCount = includeCpmTxt() ? 0 : (await openSongbook(folder, [TXT_SONG_EXTENSION]).listFilenames()).length;
    showStatus(txtCount
      ? `${name} has no <code>.cpm</code> songs, but ${txtCount} <code>.cpm.txt</code> ${txtCount === 1 ? 'song' : 'songs'}: tick "Also list <code>.cpm.txt</code> songs" to see them.`
      : `${name} has no songs (<code>*.cpm</code> files).`);
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

includeTxtBox.checked = includeCpmTxt();
includeTxtBox.addEventListener('change', () => {
  setIncludeCpmTxt(includeTxtBox.checked);
  const open = getFolder();
  if (open) showSongbook(open);
});

const folder = getFolder();
if (folder) {
  showSongbook(folder);
}
