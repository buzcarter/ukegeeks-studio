/**
 * The song list (the main window): Open Songbook… picks a folder; its songs are
 * listed sorted by title, like the Songbook ("The Rose" sorts as "Rose, The"). Each
 * one opens in its own window (or comes forward, if it's open).
 */
import {
  addRecentSongbook, ALL_EXTENSIONS, checkAccess, escapeHtml, folderName, getFolder, getSettings, loadSettings,
  onSettingsChanged, openSongbook, openSongbookSong, openSongFile, pickFolder, pickSongFile, recentList,
  setFolder, songExtensions,
} from './songbook.js';
import { onMenu } from './menu.js';
import { newSong } from './new-song.js';

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
  addRecentSongbook(folder);
  const songs = await openSongbook(folder).getSongList();
  const name = `<strong title="${escapeHtml(folder)}">${escapeHtml(folderName(folder))}</strong>`;
  const count = songs.length === 1 ? '1 song' : `${songs.length} songs`;
  showStatus(`${name}: ${count}`);
  if (!songs.length) {
    // for example a Songbook folder: all ".cpm.txt", listed only with ".txt" on in Settings
    const listed = getSettings().songExtensions;
    const types = listed.map((ext) => `<code>${ext}</code>`).join(', ');
    const others = await otherSongTypes(folder, listed);
    showStatus(others.count
      ? `${name} has no ${types} songs, but ${others.count} ${others.count === 1 ? 'file' : 'files'} of other song types (${others.types.map((ext) => `<code>${ext}</code>`).join(', ')}): turn them on in Settings (Cmd+,) to see them.`
      : `${name} has no songs (${types} files).`);
    return;
  }
  listEl.innerHTML = songs
    .map((song) => {
      const details = [song.artist, song.subtitle].filter(Boolean).map(escapeHtml).join(' · ');
      return `<li><a href="${escapeHtml(song.uri)}" data-filename="${escapeHtml(song.filename)}">`
        + `<span class="songTitle">${escapeHtml(song.title)}</span>`
        + (details ? ` <span class="songDetails">${details}</span>` : '')
        + '</a></li>';
    })
    .join('');
}

/** Song files in the folder of the types Settings doesn't list: { count, types }. */
async function otherSongTypes(folder, listed) {
  const off = ALL_EXTENSIONS.filter((ext) => !listed.includes(ext));
  if (!off.length) return { count: 0, types: [] };
  const repo = openSongbook(folder, songExtensions(off));
  const names = await repo.listFilenames();
  const types = [...new Set(names.map((n) => repo.extensionOf(n)))].sort();
  return { count: names.length, types };
}

async function chooseSongbook() {
  try {
    const folder = await pickFolder();
    if (folder) await showSongbook(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
}

/** File > Open… (Cmd+O): one song on its own, in its own window. */
async function chooseSong() {
  try {
    const path = await pickSongFile();
    if (path) await openSongFile(path);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
}

// A song opens in its own window rather than in this one
listEl.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-filename]');
  const folder = getFolder();
  if (!link || !folder || event.defaultPrevented) return;
  event.preventDefault();
  openSongbookSong(folder, link.dataset.filename);
});

document.getElementById('openSongbook').addEventListener('click', chooseSongbook);
document.getElementById('openSong').addEventListener('click', chooseSong);
document.getElementById('newSong').addEventListener('click', () => newSong());
onMenu('new-song', () => newSong());
// File > Open Songbook… (Shift+Cmd+O) and Open… (Cmd+O). Save and Save As do nothing
// here; Quit quits.
onMenu('open-songbook', chooseSongbook);
onMenu('open-file', chooseSong);
// File > Open Recent, a songbook (a recent song opens in its own window)
onMenu('open-recent', ({ folder }) => {
  setFolder(folder);
  return showSongbook(folder);
});

// Settings changed which song types to list
onSettingsChanged(() => {
  const open = getFolder();
  if (open) showSongbook(open);
});

// The songbook open in this run of the app, else (if Settings says so) the last one
// opened (File > Open Recent).
async function showFirstSongbook() {
  await loadSettings();
  let folder = getFolder();
  if (!folder && getSettings().reopenLastSongbook) {
    folder = (await recentList()).songbooks[0];
    if (folder) setFolder(folder);
  }
  if (folder) await showSongbook(folder);
}

// The song list was closed and opened again (src-tauri/src/windows.rs):
// index.html?open=1 for File > Open Songbook… (the picker shows over the last
// songbook, which stays if it's cancelled); index.html?folder=… for a recent songbook.
const params = new URLSearchParams(location.search);
const showPicker = params.has('open');
if (params.get('folder')) setFolder(params.get('folder'));
if (location.search) history.replaceState(null, '', 'index.html');
showFirstSongbook().then(() => showPicker && chooseSongbook());
