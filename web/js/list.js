/**
 * The song list (the main window), with the Library beside it: the songbooks the
 * player added, in a sidebar. Selecting one lists its songs, sorted by title like
 * the Songbook ("The Rose" sorts as "Rose, The"). Each song opens in its own window
 * (or comes forward, if it's open).
 *
 * + (or File > Add Songbook to Library…) adds a folder and asks for the songbook's
 * name. Right-click a songbook for Open, New Song…, Rename… (or double-click it)
 * and Remove from Library (or −), which takes it out; its folder and songs stay on
 * disk.
 *
 * The search box (Cmd+F) searches every songbook in the Library by title, artist or
 * lyrics (web/js/search.js); clearing it (or Esc) shows the songbook again.
 */
import {
  addSongbook, ALL_EXTENSIONS, checkAccess, escapeHtml, getFolder, getLibrary, getSettings, loadSettings,
  onLibraryChanged, onSettingsChanged, openSongbook, openSongbookSong, openSongFile, pickSongFile, removeSongbook,
  renameSongbook, selectSongbook, setFolder, songbookName, songExtensions,
} from './songbook.js';
import { onMenu } from './menu.js';
import { newSong } from './new-song.js';
import { fold, makeEntry, searchSongs } from './search.js';

const { parseSong, fixLeadingArticle, filenameToTitle } = globalThis.studioSongs;

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');
const songbooksEl = document.getElementById('songbookList');
const removeBtn = document.getElementById('removeSongbook');
const searchEl = document.getElementById('librarySearch');
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

const inLibrary = (folder) => library.songbooks.some((s) => s.folder === folder);

/** The sidebar: the Library's songbooks by name, the open one highlighted. */
function showLibrary() {
  const open = getFolder();
  const names = library.songbooks.map((s) => s.name.toLowerCase());
  const items = library.songbooks
    .map(({ folder, name }, i) => ({ folder, name, twin: names.filter((n) => n === names[i]).length > 1 }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }));
  songbooksEl.innerHTML = items
    .map(({ folder, name, twin }) => `<li><button type="button" data-folder="${escapeHtml(folder)}" title="${escapeHtml(folder)}"`
      + ` aria-current="${folder === open}">${escapeHtml(name)}`
      + (twin ? ` <span class="songbookParent">— ${escapeHtml(parentName(folder))}</span>` : '')
      + '</button></li>')
    .join('');
  removeBtn.disabled = !inLibrary(open);
}

async function showSongbook(folder) {
  if (searching()) return; // the results stay until the search is cleared
  listEl.innerHTML = '';
  showStatus(`Reading <strong>${escapeHtml(songbookName(library, folder))}</strong>…`);
  try {
    await checkAccess(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message), true);
    return;
  }
  const songs = await openSongbook(folder).getSongList();
  const name = `<strong title="${escapeHtml(folder)}">${escapeHtml(songbookName(library, folder))}</strong>`;
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

/** Right-click > Rename… or double-click: a new name for the songbook (not the folder). */
async function renameFolder(folder) {
  try {
    const next = await renameSongbook(library, folder);
    if (!next) return;
    library = next;
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
    return;
  }
  showLibrary();
  if (getFolder() === folder) showSongbook(folder);
}

songbooksEl.addEventListener('dblclick', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) renameFolder(button.dataset.folder);
});

// Right-click a songbook: Open, New Song…, Rename…, Remove from Library
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
  contextMenu.setAttribute('role', 'menu');
  contextMenu.innerHTML = '<li><button type="button" role="menuitem" data-do="open">Open</button></li>'
    + '<li><button type="button" role="menuitem" data-do="new-song">New Song…</button></li>'
    + '<li><button type="button" role="menuitem" data-do="rename">Rename…</button></li>'
    + '<li class="libraryMenuSeparator" role="separator"></li>'
    + '<li><button type="button" role="menuitem" data-do="remove">Remove from Library</button></li>';
  contextMenu.addEventListener('click', (e) => {
    const item = e.target.closest('button[data-do]');
    if (!item) return;
    closeContextMenu();
    const actions = {
      open: () => openFromSidebar(folder),
      'new-song': () => newSong({ folder }),
      rename: () => renameFolder(folder),
      remove: () => removeFolder(folder),
    };
    actions[item.dataset.do]();
  });
  document.body.append(contextMenu);
  // where the click was, kept inside the window
  const { width, height } = contextMenu.getBoundingClientRect();
  contextMenu.style.left = `${Math.min(event.clientX, innerWidth - width - 4)}px`;
  contextMenu.style.top = `${Math.min(event.clientY, innerHeight - height - 4)}px`;
});
document.addEventListener('click', (event) => {
  if (contextMenu && !contextMenu.contains(event.target)) closeContextMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeContextMenu();
});

/** Clicking a songbook, or right-click > Open: shows its songs, ending a search. */
function openFromSidebar(folder) {
  if (searching()) {
    searchEl.value = '';
    selectFolder(folder);
  } else if (folder !== getFolder()) {
    selectFolder(folder);
  }
}

songbooksEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) openFromSidebar(button.dataset.folder);
});

// A song opens in its own window rather than in this one; a search result says
// which songbook it's from
listEl.addEventListener('click', (event) => {
  const link = event.target.closest('a[data-filename]');
  const folder = link && (link.dataset.folder || getFolder());
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
  searchIndex = null;
  if (searching()) runSearch();
  const open = getFolder();
  if (open) showSongbook(open);
});

// A songbook was added elsewhere (New Song… in a song window with none open)
onLibraryChanged((next) => {
  library = next;
  searchIndex = null;
  showLibrary();
  if (searching()) runSearch();
});

// ---- Search ----

/** Every song of the Library, ready for searchSongs(); built when a search starts. */
let searchIndex = null;
let searchRun = 0;

const searching = () => searchEl.value.trim() !== '';

/** Reads every songbook's songs. Songbooks that can't be read are skipped. */
async function buildSearchIndex() {
  const perSongbook = await Promise.all(library.songbooks.map(async ({ folder, name }) => {
    const repo = openSongbook(folder);
    const filenames = await repo.listFilenames().catch(() => []);
    const songs = await Promise.all(filenames.map(async (filename) => {
      const text = await repo.read(filename);
      if (!text) return null;
      const song = parseSong(text);
      return makeEntry({
        folder,
        songbook: name,
        filename,
        title: fixLeadingArticle(song.title || filenameToTitle(repo.baseName(filename))),
        artist: song.artist,
        body: song.body,
      });
    }));
    return songs.filter(Boolean);
  }));
  return perSongbook.flat();
}

/** The snippet with the search's words marked. */
function markWords(text, query) {
  const words = fold(query).split(' ').filter(Boolean);
  const folded = fold(text);
  // marks by position in the folded text, which lines up with the original only
  // when folding kept its length; otherwise the snippet goes unmarked
  if (folded.length !== text.length || !words.length) return escapeHtml(text);
  const marks = new Array(text.length).fill(false);
  for (const word of words) {
    for (let i = folded.indexOf(word); i >= 0; i = folded.indexOf(word, i + 1)) {
      marks.fill(true, i, i + word.length);
    }
  }
  let html = '';
  let open = false;
  for (let i = 0; i < text.length; i += 1) {
    if (marks[i] !== open) {
      html += marks[i] ? '<mark>' : '</mark>';
      open = marks[i];
    }
    html += escapeHtml(text[i]);
  }
  return open ? `${html}</mark>` : html;
}

async function runSearch() {
  const query = searchEl.value.trim();
  const run = ++searchRun;
  if (!query) {
    const open = getFolder();
    if (open) showSongbook(open);
    else showNothingOpen();
    return;
  }
  if (!searchIndex) {
    showStatus('Searching the Library…');
    searchIndex = buildSearchIndex();
  }
  let entries;
  try {
    entries = await searchIndex;
  } catch (err) {
    searchIndex = null;
    showStatus(escapeHtml(err.message || String(err)), true);
    return;
  }
  if (run !== searchRun) return; // typed again meanwhile
  const results = searchSongs(entries, query);
  const quoted = `“${escapeHtml(query)}”`;
  showStatus(results.length
    ? `${results.length === 1 ? '1 song matches' : `${results.length} songs match`} ${quoted} in the Library`
    : `No songs in the Library match ${quoted}.`);
  listEl.innerHTML = results
    .map(({ entry, snippet }) => `<li><a href="#" data-folder="${escapeHtml(entry.folder)}" data-filename="${escapeHtml(entry.filename)}">`
      + `<span class="songTitle">${escapeHtml(entry.title)}</span>`
      + (entry.artist ? ` <span class="songDetails">${escapeHtml(entry.artist)}</span>` : '')
      + `<span class="songSongbook" title="${escapeHtml(entry.folder)}">${escapeHtml(entry.songbook)}</span>`
      + (snippet ? `<span class="songSnippet">${markWords(snippet, query)}</span>` : '')
      + '</a></li>')
    .join('');
}

let searchTimer = null;
searchEl.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(runSearch, 120);
});
searchEl.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && searchEl.value) {
    event.preventDefault();
    searchEl.value = '';
    runSearch();
  }
});
// Cmd+F (Ctrl+F on Windows) in this window: the search box
document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'f') {
    event.preventDefault();
    searchEl.focus();
    searchEl.select();
  }
});
// Songs may have changed in their windows meanwhile: read them again next time
window.addEventListener('focus', () => {
  searchIndex = null;
  if (searching()) runSearch();
});

// The songbook open in this window, else (if Settings says so) the one selected
// last time.
async function showFirstSongbook() {
  await loadSettings();
  library = await getLibrary();
  let folder = getFolder();
  if (!inLibrary(folder)) folder = null;
  if (!folder && getSettings().reopenLastSongbook && inLibrary(library.selected)) {
    folder = library.selected;
  }
  if (folder) await selectFolder(folder);
  else {
    showLibrary();
    showNothingOpen();
  }
}

// The song list was closed and a menu item opened it again (src-tauri/src/windows.rs):
// index.html?open=1 for File > Add Songbook to Library… (shows the picker);
// index.html?menu=new-song or menu=open-file for New Song… and Open….
const params = new URLSearchParams(location.search);
const showPicker = params.has('open');
const menuItem = params.get('menu');
if (location.search) history.replaceState(null, '', 'index.html');
showFirstSongbook().then(() => {
  if (showPicker) chooseSongbook();
  else if (menuItem === 'new-song') newSong();
  else if (menuItem === 'open-file') chooseSong();
});
