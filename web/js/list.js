/**
 * The song list (the main window), with the Library beside it: the songbooks the
 * player added, in a sidebar. Selecting one lists its songs, sorted by title like
 * the Songbook ("The Rose" sorts as "Rose, The"). Each song opens in its own window
 * (or comes forward, if it's open).
 *
 * + (or File > Add Songbook to Library…) adds a folder; − or right-click > Remove
 * from Library takes the selected one out. Its folder and songs stay on disk.
 */
import {
  addSongbook, ALL_EXTENSIONS, checkAccess, escapeHtml, folderName, getFolder, getLibrary, getSettings,
  loadSettings, onLibraryChanged, onSettingsChanged, openSongbook, openSongbookSong, openSongFile, pickSongFile,
  removeSongbook, selectSongbook, setFolder, songExtensions,
} from './songbook.js';
import { onMenu } from './menu.js';
import { newSong } from './new-song.js';

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');
const songbooksEl = document.getElementById('songbookList');
const removeBtn = document.getElementById('removeSongbook');
const firstStatus = statusEl.innerHTML;

let library = { songbooks: [], selected: null };

function showStatus(html, isError = false) {
  statusEl.innerHTML = html;
  statusEl.classList.toggle('isError', isError);
}

/** The folder's parent's name, to tell apart two songbooks with the same name. */
function parentName(folder) {
  const parts = folder.replace(/[\/\\]+$/, '').split(/[\/\\]/);
  return parts.length > 1 ? parts[parts.length - 2] : '';
}

/** The sidebar: the Library's songbooks by name, the open one highlighted. */
function showLibrary() {
  const open = getFolder();
  const names = library.songbooks.map(folderName);
  const items = library.songbooks
    .map((folder, i) => ({ folder, name: names[i], twin: names.filter((n) => n === names[i]).length > 1 }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  songbooksEl.innerHTML = items
    .map(({ folder, name, twin }) => `<li><button type="button" data-folder="${escapeHtml(folder)}" title="${escapeHtml(folder)}"`
      + ` aria-current="${folder === open}">${escapeHtml(name)}`
      + (twin ? ` <span class="songbookParent">— ${escapeHtml(parentName(folder))}</span>` : '')
      + '</button></li>')
    .join('');
  removeBtn.disabled = !library.songbooks.includes(open);
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

/** Opens a songbook of the Library in this window and remembers it for next time. */
async function selectFolder(folder) {
  setFolder(folder);
  showLibrary();
  selectSongbook(folder);
  await showSongbook(folder);
}

function showNothingOpen() {
  listEl.innerHTML = '';
  showStatus(library.songbooks.length
    ? 'Choose a songbook in the Library.'
    : firstStatus);
}

/** + and File > Add Songbook to Library… (Shift+Cmd+O) */
async function chooseSongbook() {
  try {
    const folder = await addSongbook();
    if (!folder) return;
    library = await getLibrary();
    await selectFolder(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
}

/** − and right-click > Remove from Library. The folder stays on disk. */
async function removeFolder(folder) {
  try {
    library = await removeSongbook(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
    return;
  }
  if (getFolder() === folder) {
    try { sessionStorage.removeItem('studio.songbookFolder'); } catch { /* nothing open anyway */ }
    showNothingOpen();
  }
  showLibrary();
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

// Right-click a songbook: a small menu with Remove from Library
let contextMenu = null;
function closeContextMenu() {
  if (contextMenu) contextMenu.remove();
  contextMenu = null;
}
songbooksEl.addEventListener('contextmenu', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (!button) return;
  event.preventDefault();
  closeContextMenu();
  const { folder } = button.dataset;
  contextMenu = document.createElement('ul');
  contextMenu.className = 'libraryMenu';
  contextMenu.innerHTML = '<li><button type="button">Remove from Library</button></li>';
  contextMenu.style.left = `${event.clientX}px`;
  contextMenu.style.top = `${event.clientY}px`;
  contextMenu.querySelector('button').addEventListener('click', () => {
    closeContextMenu();
    removeFolder(folder);
  });
  document.body.append(contextMenu);
});
document.addEventListener('click', (event) => {
  if (contextMenu && !contextMenu.contains(event.target)) closeContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeContextMenu();
});

songbooksEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button && button.dataset.folder !== getFolder()) selectFolder(button.dataset.folder);
});

// A song opens in its own window rather than in this one
listEl.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-filename]');
  const folder = getFolder();
  if (!link || !folder || event.defaultPrevented) return;
  event.preventDefault();
  openSongbookSong(folder, link.dataset.filename);
});

document.getElementById('addSongbook').addEventListener('click', chooseSongbook);
document.getElementById('openSongbook').addEventListener('click', chooseSongbook);
removeBtn.addEventListener('click', () => {
  const open = getFolder();
  if (open) removeFolder(open);
});
document.getElementById('openSong').addEventListener('click', chooseSong);
document.getElementById('newSong').addEventListener('click', () => newSong());
onMenu('new-song', () => newSong());
// File > Add Songbook to Library… (Shift+Cmd+O; its id is from Open Songbook…) and
// Open… (Cmd+O). Save and Save As do nothing here; Quit quits.
onMenu('open-songbook', chooseSongbook);
onMenu('open-file', chooseSong);

// Settings changed which song types to list
onSettingsChanged(() => {
  const open = getFolder();
  if (open) showSongbook(open);
});

// A songbook was added elsewhere (New Song… in a song window with none open)
onLibraryChanged((next) => {
  library = next;
  showLibrary();
});

// The songbook open in this window, else (if Settings says so) the one selected
// last time.
async function showFirstSongbook() {
  await loadSettings();
  library = await getLibrary();
  let folder = getFolder();
  if (!library.songbooks.includes(folder)) folder = null;
  if (!folder && getSettings().reopenLastSongbook && library.songbooks.includes(library.selected)) {
    folder = library.selected;
  }
  if (folder) await selectFolder(folder);
  else {
    showLibrary();
    showNothingOpen();
  }
}

// The song list was closed and opened again by File > Add Songbook to Library…
// (src-tauri/src/windows.rs): index.html?open=1 shows the picker.
const showPicker = new URLSearchParams(location.search).has('open');
if (location.search) history.replaceState(null, '', 'index.html');
showFirstSongbook().then(() => showPicker && chooseSongbook());
