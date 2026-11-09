/**
 * The song list (the main window), with the Library beside it: the songbooks the
 * player added, in a sidebar. Selecting one lists its songs, sorted by title like
 * the Songbook ("The Rose" sorts as "Rose, The"). Each song opens in its own window
 * (or comes forward, if it's open).
 *
 * File > Add Songbook to Library… (or Add Songbook…) adds a folder and asks for the
 * songbook's name. Right-click a songbook for Open, New Song…, Rename… (or
 * double-click it), Open Folder (in Finder), Change Folder…, Bundle all as PDF
 * (not yet) and Remove from Library (after asking), which takes it out; its folder
 * and songs stay on disk. A songbook whose folder can't be read shows a "!".
 *
 * All Songs, under Favorites, lists the songs of every songbook, sorted by title.
 *
 * The search box (Cmd+F) searches every songbook in the Library by title, artist or
 * lyrics (web/js/search.js); clearing it (or Esc) shows the songbook again.
 *
 * Favorites (src-tauri/src/favorites.rs): the ☆ beside every song (in a songbook, in
 * search results, and in song windows) stars it. Favorites, at the top of the
 * sidebar, lists the starred songs of every songbook, sorted by title.
 */
import {
  addSongbook, ALL_EXTENSIONS, ALL_SELECTED, changeSongbookFolder, checkAccess, escapeHtml, FAVORITES_SELECTED, favoriteSongs, getFavorites, getFolder,
  getLibrary, getSettings, isStarred, loadSettings, onFavoritesChanged, onLibraryChanged, onSettingsChanged,
  openSongbook, openSongbookSong, openSongFile, pickSongFile, removeSongbook, renameSongbook, revealSongbook, selectSongbook,
  setFolder, songbookName, songExtensions, starSong, tauri,
} from './songbook.js';
import { onMenu } from './menu.js';
import { newSong } from './new-song.js';
import { fold, makeEntry, searchSongs } from './search.js';

const { parseSong, fixLeadingArticle, filenameToTitle } = globalThis.studioSongs;

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');
const songbooksEl = document.getElementById('songbookList');
const searchEl = document.getElementById('librarySearch');
const favoritesBtn = document.getElementById('showFavorites');
const allBtn = document.getElementById('showAll');
const firstStatus = statusEl.innerHTML;

let library = { songbooks: [], selected: null };
let favorites = { lists: [] };
/** Favorites is selected in the sidebar (instead of a songbook) */
let showingFavorites = false;
/** All Songs is selected in the sidebar */
let showingAll = false;
/** Folders of the Library that can't be read now (moved, renamed, drive unplugged) */
let brokenFolders = new Set();
// remembered for this window, like the open songbook (getFolder)
const FAVORITES_KEY = 'studio.showingFavorites';
function rememberFavorites(on) {
  try {
    if (on) sessionStorage.setItem(FAVORITES_KEY, '1');
    else sessionStorage.removeItem(FAVORITES_KEY);
  } catch { /* the Library's `selected` still has it */ }
}
function wasShowingFavorites() {
  try { return sessionStorage.getItem(FAVORITES_KEY) === '1'; } catch { return false; }
}
const ALL_KEY = 'studio.showingAll';
function rememberAll(on) {
  try {
    if (on) sessionStorage.setItem(ALL_KEY, '1');
    else sessionStorage.removeItem(ALL_KEY);
  } catch { /* the Library's `selected` still has it */ }
}
function wasShowingAll() {
  try { return sessionStorage.getItem(ALL_KEY) === '1'; } catch { return false; }
}
/** A list of every songbook's songs (Favorites, All Songs) is selected, not one songbook */
const showingList = () => showingFavorites || showingAll;
const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });

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
    .map(({ folder, name, twin }) => `<li><button type="button" data-folder="${escapeHtml(folder)}"`
      + ` title="${escapeHtml(brokenFolders.has(folder) ? `Can't read this folder: ${folder}` : folder)}"`
      + ` aria-current="${!showingList() && folder === open}">`
      + (brokenFolders.has(folder) ? '<span class="songbookBroken" aria-label="Folder can\'t be read">!</span> ' : '')
      + escapeHtml(name)
      + (twin ? ` <span class="songbookParent">— ${escapeHtml(parentName(folder))}</span>` : '')
      + '</button></li>')
    .join('');
  favoritesBtn.setAttribute('aria-current', String(showingFavorites));
  allBtn.setAttribute('aria-current', String(showingAll));
}

/** Which songbooks' folders can't be read; the sidebar marks them with a "!". */
async function checkFolders() {
  const checked = await Promise.all(library.songbooks.map(async ({ folder }) => {
    try {
      await tauri().fs.readDir(folder);
      return null;
    } catch {
      return folder;
    }
  }));
  const next = new Set(checked.filter(Boolean));
  if (next.size === brokenFolders.size && [...next].every((f) => brokenFolders.has(f))) return;
  brokenFolders = next;
  showLibrary();
}

/**
 * A song in the list: its ☆/★ (Favorites) and a link that opens it. inner: the
 * link's HTML. missing: a favorite whose file is gone.
 */
function songRow({ folder, filename, inner, missing = false }) {
  const starred = isStarred(favorites, folder, filename);
  const label = starred ? 'Remove from Favorites' : 'Add to Favorites';
  return `<li class="songRow${missing ? ' isMissing' : ''}">`
    + `<button type="button" class="songStar" data-folder="${escapeHtml(folder)}" data-filename="${escapeHtml(filename)}"`
    + ` aria-pressed="${starred}" title="${label}" aria-label="${label}">${starred ? '★' : '☆'}</button>`
    + `<a href="#" data-folder="${escapeHtml(folder)}" data-filename="${escapeHtml(filename)}"${missing ? ' data-missing="1"' : ''}>`
    + `${inner}</a></li>`;
}

/** The stars shown, after a star changed (here or in a song window). */
function showStars() {
  for (const star of listEl.querySelectorAll('button.songStar')) {
    const starred = isStarred(favorites, star.dataset.folder, star.dataset.filename);
    const label = starred ? 'Remove from Favorites' : 'Add to Favorites';
    star.setAttribute('aria-pressed', String(starred));
    star.textContent = starred ? '★' : '☆';
    star.title = label;
    star.setAttribute('aria-label', label);
  }
}

/** Favorites changed: Favorites lists them again; elsewhere just the stars change. */
function favoritesChanged(next) {
  favorites = next;
  if (showingFavorites && !searching()) showFavorites();
  else showStars();
}

async function toggleStar(star) {
  const starred = star.getAttribute('aria-pressed') !== 'true';
  try {
    favoritesChanged(await starSong(star.dataset.folder, star.dataset.filename, starred));
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
}

/** Whatever is selected in the sidebar, shown again (unless a search is showing). */
function showSelected() {
  const open = getFolder();
  if (showingFavorites) showFavorites();
  else if (showingAll) showAllSongs();
  else if (open) showSongbook(open);
  else showNothingOpen();
}

let favoritesRun = 0;

/**
 * Favorites: the starred songs of every songbook in the Library, sorted by title,
 * each with its songbook. A starred song whose file is gone shows as "not found".
 */
async function showFavorites() {
  if (searching()) return;
  const run = ++favoritesRun;
  const starred = favoriteSongs(favorites).filter((s) => inLibrary(s.folder));
  if (!starred.length) {
    listEl.innerHTML = '';
    showStatus('<strong>Favorites</strong>: none yet. Click the ☆ beside a song, in any songbook, to add it here.');
    return;
  }
  const entries = await Promise.all(starred.map(async ({ folder, file }) => {
    const repo = openSongbook(folder);
    const text = await repo.read(file);
    const song = text == null ? null : parseSong(text);
    return {
      folder,
      filename: file,
      songbook: songbookName(library, folder),
      title: fixLeadingArticle((song && song.title) || filenameToTitle(repo.baseName(file))),
      details: song ? [song.artist, song.subtitle].filter(Boolean) : [],
      missing: !song,
    };
  }));
  if (run !== favoritesRun || !showingFavorites || searching()) return; // something else meanwhile
  entries.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.songbook, b.songbook));
  const missing = entries.filter((e) => e.missing).length;
  showStatus(`<strong>Favorites</strong>: ${entries.length === 1 ? '1 song' : `${entries.length} songs`}`
    + (missing ? ` (${missing} not found)` : ''));
  listEl.innerHTML = entries
    .map((entry) => songRow({
      ...entry,
      inner: `<span class="songTitle">${escapeHtml(entry.title)}</span>`
        + (entry.details.length ? ` <span class="songDetails">${entry.details.map(escapeHtml).join(' · ')}</span>` : '')
        + `<span class="songSongbook" title="${escapeHtml(entry.folder)}">${escapeHtml(entry.songbook)}</span>`
        + (entry.missing ? ' <span class="songMissing">not found</span>' : ''),
    }))
    .join('');
}

let allRun = 0;

/**
 * All Songs: the songs of every songbook in the Library, sorted by title, each with
 * its songbook. Songbooks whose folders can't be read are left out, and said so.
 */
async function showAllSongs() {
  if (searching()) return;
  const run = ++allRun;
  listEl.innerHTML = '';
  showStatus('Reading the Library…');
  const perSongbook = await Promise.all(library.songbooks.map(async ({ folder, name }) => {
    try {
      await checkAccess(folder);
      const songs = await openSongbook(folder).getSongList();
      return songs.map((song) => ({ ...song, folder, songbook: name }));
    } catch {
      return null;
    }
  }));
  if (run !== allRun || !showingAll || searching()) return; // something else meanwhile
  const songs = perSongbook.filter(Boolean).flat();
  const unreadable = perSongbook.filter((s) => !s).length;
  songs.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.songbook, b.songbook));
  const skipped = unreadable ? ` (${unreadable === 1 ? '1 songbook' : `${unreadable} songbooks`} can't be read)` : '';
  if (!songs.length) {
    showStatus(`<strong>All Songs</strong>: none yet. Add a songbook to the Library.${skipped}`);
    return;
  }
  showStatus(`<strong>All Songs</strong>: ${songs.length === 1 ? '1 song' : `${songs.length} songs`}${skipped}`);
  listEl.innerHTML = songs
    .map((song) => {
      const details = [song.artist, song.subtitle].filter(Boolean).map(escapeHtml).join(' · ');
      return songRow({
        folder: song.folder,
        filename: song.filename,
        inner: `<span class="songTitle">${escapeHtml(song.title)}</span>`
          + (details ? ` <span class="songDetails">${details}</span>` : '')
          + `<span class="songSongbook" title="${escapeHtml(song.folder)}">${escapeHtml(song.songbook)}</span>`,
      });
    })
    .join('');
}

/** Clicking All Songs in the sidebar: shows them, ending a search. */
async function selectAll() {
  searchEl.value = '';
  showingAll = true;
  showingFavorites = false;
  rememberAll(true);
  rememberFavorites(false);
  showLibrary();
  selectSongbook(ALL_SELECTED);
  await showAllSongs();
}

/** Clicking Favorites in the sidebar: shows them, ending a search. */
async function selectFavorites() {
  searchEl.value = '';
  showingFavorites = true;
  showingAll = false;
  rememberFavorites(true);
  rememberAll(false);
  showLibrary();
  selectSongbook(FAVORITES_SELECTED);
  await showFavorites();
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
  if (showingList() || searching()) return; // chosen something else meanwhile
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
      return songRow({
        folder,
        filename: song.filename,
        inner: `<span class="songTitle">${escapeHtml(song.title)}</span>`
          + (details ? ` <span class="songDetails">${details}</span>` : ''),
      });
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
  showingFavorites = false;
  showingAll = false;
  rememberFavorites(false);
  rememberAll(false);
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

/** Right-click > Remove from Library, after asking. The folder stays on disk. */
async function removeFolder(folder) {
  const name = songbookName(library, folder);
  const sure = await tauri().dialog.ask(
    `Remove “${name}” from the Library? Its folder and songs stay on your disk, and you can add the folder again later.`,
    { title: 'Remove Songbook', kind: 'warning', okLabel: 'Remove', cancelLabel: 'Cancel' },
  );
  if (!sure) return;
  try {
    library = await removeSongbook(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
    return;
  }
  if (getFolder() === folder) {
    try { sessionStorage.removeItem('studio.songbookFolder'); } catch { /* nothing open anyway */ }
    if (!showingList()) showNothingOpen();
  }
  showLibrary();
  checkFolders();
  // its favorites aren't shown while it's out of the Library
  if (showingFavorites && !searching()) showFavorites();
  else if (showingAll && !searching()) showAllSongs();
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
  if (searching()) runSearch();
  else if (showingList() || getFolder() === folder) showSelected();
}

/** Right-click > Open Folder: in Finder. */
async function openFolder(folder) {
  try {
    await revealSongbook(folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
  }
}

/** Right-click > Change Folder…: the songbook is somewhere else now. */
async function changeFolder(folder) {
  try {
    const changed = await changeSongbookFolder(folder);
    if (!changed) return;
    library = changed.library;
    // this window follows the songbook, if it had it open
    if (getFolder() === folder) setFolder(changed.folder);
  } catch (err) {
    showStatus(escapeHtml(err.message || String(err)), true);
    return;
  }
  favorites = await getFavorites();
  searchIndex = null;
  await checkFolders();
  showLibrary();
  if (searching()) runSearch();
  else showSelected();
}

songbooksEl.addEventListener('dblclick', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) renameFolder(button.dataset.folder);
});

// Right-click a songbook: Open, New Song…, Rename…, Open Folder, Change Folder…,
// Bundle all as PDF (disabled for now), Remove from Library
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
    + '<li><button type="button" role="menuitem" data-do="reveal">Open Folder</button></li>'
    + '<li><button type="button" role="menuitem" data-do="change-folder">Change Folder…</button></li>'
    + '<li><button type="button" role="menuitem" data-do="bundle-pdf" disabled>Bundle all as PDF…</button></li>'
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
      reveal: () => openFolder(folder),
      'change-folder': () => changeFolder(folder),
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
  } else if (showingList() || folder !== getFolder()) {
    selectFolder(folder);
  }
}

songbooksEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) openFromSidebar(button.dataset.folder);
});
favoritesBtn.addEventListener('click', () => {
  if (!showingFavorites || searching()) selectFavorites();
});
allBtn.addEventListener('click', () => {
  if (!showingAll || searching()) selectAll();
});

// A song opens in its own window rather than in this one; a search result says
// which songbook it's from
listEl.addEventListener('click', (event) => {
  const star = event.target.closest('button.songStar');
  if (star) {
    toggleStar(star);
    return;
  }
  const link = event.target.closest('a[data-filename]');
  const folder = link && (link.dataset.folder || getFolder());
  if (!link || !folder || event.defaultPrevented) return;
  event.preventDefault();
  if (link.dataset.missing) {
    showStatus(`“${escapeHtml(link.dataset.filename)}” isn't in <strong>${escapeHtml(songbookName(library, folder))}</strong> any more:`
      + ' it was moved, renamed or deleted outside the app. Click its ★ to take it out of Favorites.', true);
    return;
  }
  openSongbookSong(folder, link.dataset.filename);
});

document.getElementById('openSongbook').addEventListener('click', chooseSongbook);
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
  else showSelected();
});

// A songbook was added elsewhere (New Song… in a song window with none open)
onLibraryChanged((next) => {
  library = next;
  searchIndex = null;
  showLibrary();
  checkFolders();
  if (searching()) runSearch();
  else if (showingFavorites) showFavorites(); // songbook names, or songbooks gone
  else if (showingAll) showAllSongs();
});

// A song was starred or unstarred (here, or in a song window)
onFavoritesChanged(favoritesChanged);

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
    showSelected();
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
    .map(({ entry, snippet }) => songRow({
      folder: entry.folder,
      filename: entry.filename,
      inner: `<span class="songTitle">${escapeHtml(entry.title)}</span>`
        + (entry.artist ? ` <span class="songDetails">${escapeHtml(entry.artist)}</span>` : '')
        + `<span class="songSongbook" title="${escapeHtml(entry.folder)}">${escapeHtml(entry.songbook)}</span>`
        + (snippet ? `<span class="songSnippet">${markWords(snippet, query)}</span>` : ''),
    }))
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
  checkFolders();
  if (searching()) runSearch();
  else if (showingFavorites) showFavorites(); // titles may have changed
  else if (showingAll) showAllSongs();
});

// The songbook (or Favorites) open in this window, else (if Settings says so) the
// songbook, or Favorites, selected last time.
async function showFirstSongbook() {
  await loadSettings();
  [library, favorites] = await Promise.all([getLibrary(), getFavorites()]);
  let folder = getFolder();
  if (!inLibrary(folder)) folder = null;
  const reopen = getSettings().reopenLastSongbook;
  checkFolders();
  if (wasShowingFavorites()) await selectFavorites();
  else if (wasShowingAll()) await selectAll();
  else if (!folder && reopen && library.selected === FAVORITES_SELECTED) await selectFavorites();
  else if (!folder && reopen && library.selected === ALL_SELECTED) await selectAll();
  else if (!folder && reopen && inLibrary(library.selected)) await selectFolder(library.selected);
  else if (folder) await selectFolder(folder);
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
