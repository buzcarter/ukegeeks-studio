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
 * The search box (Cmd+F) searches what the sidebar has selected, by title, artist or
 * lyrics (web/js/lib/search.js): the open songbook, Favorites, or (All Songs) every
 * songbook in the Library. Clearing it (or Esc) shows the list again.
 *
 * Favorites (src-tauri/src/favorites.rs): the ☆ beside every song (in a songbook, in
 * search results, and in song windows) stars it. Favorites, at the top of the
 * sidebar, lists the starred songs of every songbook, sorted by title.
 *
 * What the list shows is one of four things: a search's results while the search box
 * has text, else the sidebar's selection (`view`): a songbook, Favorites or All Songs.
 * Reading songs takes a moment, so each show…() takes a turn number (`startShowing`)
 * and gives up if something else was shown meanwhile.
 */
import { newSong } from './dialogs/new-song.js';
import { ALL_EXTENSIONS, getSettings, loadSettings, onSettingsChanged, songExtensions } from './lib/app-settings.js';
import { favoriteSongs, getFavorites, isStarred, onFavoritesChanged, starIsOn, starSong } from './lib/favorites.js';
import { escapeText } from './lib/html.js';
import {
  addSongbook, ALL_SELECTED, changeSongbookFolder, FAVORITES_SELECTED, findSongbook, getLibrary, onLibraryChanged,
  removeSongbook, renameSongbook, revealSongbook, selectSongbook, songbookName,
} from './lib/library.js';
import { onMenu } from './lib/menu.js';
import { parentName } from './lib/paths.js';
import { makeEntry, markWords, searchSongs } from './lib/search.js';
import {
  checkAccess, getFolder, onSongsChanged, openSongbook, openSongbookSong, openSongFile, pickSongFile, setFolder,
} from './lib/songbook.js';
import { filenameToTitle, fixLeadingArticle, parseSong } from './lib/songs.js';
import { errorMessage, onEvent, tauri } from './lib/tauri.js';
import { showContextMenu } from './ui/context-menu.js';
import { songRow, updateStars } from './ui/song-rows.js';

const statusEl = document.getElementById('songbookStatus');
const listEl = document.getElementById('songList');
const songbooksEl = document.getElementById('songbookList');
const searchEl = document.getElementById('librarySearch');
const favoritesBtn = document.getElementById('showFavorites');
const allBtn = document.getElementById('showAll');
const topActionBtn = document.getElementById('topActionButton');
const topActionMenu = document.getElementById('topActionMenu');
const firstStatus = statusEl.innerHTML;

let library = { songbooks: [], selected: null };
let favorites = { lists: [] };
/** Folders of the Library that can't be read now (moved, renamed, drive unplugged) */
let brokenFolders = new Set();

// ---- What's selected in the sidebar ----

const SONGBOOK = 'songbook';
const FAVORITES = 'favorites';
const ALL = 'all';
// remembered for this window, like the open songbook (getFolder)
const VIEW_KEY = 'studio.view';

/** SONGBOOK (the one getFolder() says), FAVORITES or ALL */
let view = SONGBOOK;

function setView(next) {
  view = next;
  try {
    sessionStorage.setItem(VIEW_KEY, next);
  } catch { /* the Library's `selected` still has it */ }
}

function savedView() {
  try {
    return sessionStorage.getItem(VIEW_KEY);
  } catch {
    return null;
  }
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const byTitleThenSongbook = (a, b) => collator.compare(a.title, b.title) || collator.compare(a.songbook, b.songbook);
const inLibrary = (folder) => !!folder && !!findSongbook(library, folder);
const searching = () => searchEl.value.trim() !== '';
const starred = (folder, filename) => isStarred(favorites, folder, filename);
/** "1 song", "3 songs" */
const count = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const bold = (text) => `<strong>${escapeText(text)}</strong>`;

// ---- The status line and the list ----

function showStatus(html, isError = false) {
  statusEl.innerHTML = html;
  statusEl.classList.toggle('isError', isError);
}

function showError(err) {
  showStatus(escapeText(errorMessage(err)), true);
}

function showRows(songs) {
  listEl.innerHTML = songs.map((song) => songRow(song, starred(song.folder, song.filename))).join('');
}

let showTurn = 0;

/**
 * Starts showing something else in the list. Returns isCurrent(): false once
 * anything newer started, so a slow read doesn't overwrite it. quiet: the same
 * thing again (a refresh), so what's there stays until the new rows are ready.
 */
function startShowing(readingHtml, quiet) {
  const turn = ++showTurn;
  if (!quiet) {
    listEl.innerHTML = '';
    showStatus(readingHtml);
  }
  return () => turn === showTurn;
}

// ---- The sidebar ----

/** The sidebar: the Library's songbooks by name, the open one highlighted. */
function showLibrary() {
  const open = getFolder();
  const names = library.songbooks.map((s) => s.name.toLowerCase());
  const items = library.songbooks
    .map(({ folder, name }, i) => ({ folder, name, twin: names.filter((n) => n === names[i]).length > 1 }))
    .sort((a, b) => collator.compare(a.name, b.name));
  songbooksEl.innerHTML = items
    .map(({ folder, name, twin }) => {
      const broken = brokenFolders.has(folder);
      return `<li><button type="button" data-folder="${escapeText(folder)}"`
        + ` title="${escapeText(broken ? `Can't read this folder: ${folder}` : folder)}"`
        + ` aria-current="${view === SONGBOOK && folder === open}">`
        + (broken ? '<span class="songbookBroken" aria-label="Folder can\'t be read">!</span> ' : '')
        + escapeText(name)
        // two songbooks with the same name: their parent folders tell them apart
        + (twin ? ` <span class="songbookParent">— ${escapeText(parentName(folder))}</span>` : '')
        + '</button></li>';
    })
    .join('');
  favoritesBtn.setAttribute('aria-current', String(view === FAVORITES));
  allBtn.setAttribute('aria-current', String(view === ALL));
  showSearchLabel();
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

// ---- Showing songs ----

/** Whatever the list should show now: the search's results, else the sidebar's selection. */
function showCurrent({ quiet = false } = {}) {
  if (searching()) return runSearch({ quiet });
  const open = getFolder();
  if (view === FAVORITES) return showFavorites({ quiet });
  if (view === ALL) return showAllSongs({ quiet });
  if (open) return showSongbook(open, { quiet });
  return showNothingOpen();
}

/** The same again, without clearing the list first: songs or stars may have changed. */
const refresh = () => showCurrent({ quiet: true });

function showNothingOpen() {
  showTurn += 1;
  listEl.innerHTML = '';
  showStatus(library.songbooks.length ? 'Choose a songbook in the Library.' : firstStatus);
}

async function showSongbook(folder, { quiet = false } = {}) {
  const name = `<strong title="${escapeText(folder)}">${escapeText(songbookName(library, folder))}</strong>`;
  const isCurrent = startShowing(`Reading ${name}…`, quiet);
  let songs;
  try {
    await checkAccess(folder);
    songs = await openSongbook(folder).getSongList();
  } catch (err) {
    if (isCurrent()) {
      listEl.innerHTML = '';
      showError(err);
    }
    return;
  }
  if (!isCurrent()) return;
  if (!songs.length) {
    // for example a Songbook folder: all ".cpm.txt", listed only with ".txt" on in Settings
    const listed = getSettings().songExtensions;
    const code = (exts) => exts.map((ext) => `<code>${escapeText(ext)}</code>`).join(', ');
    const others = await otherSongTypes(folder, listed);
    if (!isCurrent()) return;
    listEl.innerHTML = '';
    showStatus(others.count
      ? `${name} has no ${code(listed)} songs, but ${count(others.count, 'file')} of other song types (${code(others.types)}): turn them on in Settings (Cmd+,) to see them.`
      : `${name} has no songs (${code(listed)} files).`);
    return;
  }
  showStatus(`${name}: ${count(songs.length, 'song')}`);
  showRows(songs.map((song) => ({
    folder, filename: song.filename, title: song.title, details: [song.artist, song.subtitle],
  })));
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

/**
 * Favorites: the starred songs of every songbook in the Library, sorted by title,
 * each with its songbook. A starred song whose file is gone shows as "not found".
 */
async function showFavorites({ quiet = false } = {}) {
  const isCurrent = startShowing('Reading <strong>Favorites</strong>…', quiet);
  const songs = favoriteSongs(favorites).filter((s) => inLibrary(s.folder));
  if (!songs.length) {
    listEl.innerHTML = '';
    showStatus('<strong>Favorites</strong>: none yet. Click the ☆ beside a song, in any songbook, to add it here.');
    return;
  }
  const entries = await Promise.all(songs.map(async ({ folder, file }) => {
    const repo = openSongbook(folder);
    const text = await repo.read(file);
    const song = text == null ? null : parseSong(text);
    return {
      folder,
      filename: file,
      songbook: songbookName(library, folder),
      title: fixLeadingArticle((song && song.title) || filenameToTitle(repo.baseName(file))),
      details: song ? [song.artist, song.subtitle] : [],
      missing: !song,
    };
  }));
  if (!isCurrent()) return;
  entries.sort(byTitleThenSongbook);
  const missing = entries.filter((e) => e.missing).length;
  showStatus(`<strong>Favorites</strong>: ${count(entries.length, 'song')}${missing ? ` (${missing} not found)` : ''}`);
  showRows(entries);
}

/**
 * All Songs: the songs of every songbook in the Library, sorted by title, each with
 * its songbook. Songbooks whose folders can't be read are left out, and said so.
 */
async function showAllSongs({ quiet = false } = {}) {
  const isCurrent = startShowing('Reading the Library…', quiet);
  const perSongbook = await Promise.all(library.songbooks.map(async ({ folder, name }) => {
    try {
      await checkAccess(folder);
      const songs = await openSongbook(folder).getSongList();
      return songs.map((song) => ({
        folder, songbook: name, filename: song.filename, title: song.title, details: [song.artist, song.subtitle],
      }));
    } catch {
      return null;
    }
  }));
  if (!isCurrent()) return;
  const songs = perSongbook.filter(Boolean).flat().sort(byTitleThenSongbook);
  const unreadable = perSongbook.filter((s) => !s).length;
  const skipped = unreadable ? ` (${count(unreadable, 'songbook')} can't be read)` : '';
  showStatus(songs.length
    ? `<strong>All Songs</strong>: ${count(songs.length, 'song')}${skipped}`
    : `<strong>All Songs</strong>: none yet. Add a songbook to the Library.${skipped}`);
  showRows(songs);
}

// ---- Choosing in the sidebar ----

/** Selects Favorites, All Songs or a songbook in the sidebar and shows it, ending a search. */
async function select(nextView, folder = null) {
  searchEl.value = '';
  setView(nextView);
  if (folder) setFolder(folder);
  showLibrary();
  selectSongbook({ [SONGBOOK]: folder, [FAVORITES]: FAVORITES_SELECTED, [ALL]: ALL_SELECTED }[nextView]);
  await showCurrent();
}

const selectFolder = (folder) => select(SONGBOOK, folder);

/** Clicking a songbook, or right-click > Open: shows its songs, unless they're showing already. */
function openFromSidebar(folder) {
  if (searching() || view !== SONGBOOK || folder !== getFolder()) selectFolder(folder);
}

songbooksEl.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) openFromSidebar(button.dataset.folder);
});
favoritesBtn.addEventListener('click', () => {
  if (view !== FAVORITES || searching()) select(FAVORITES);
});
allBtn.addEventListener('click', () => {
  if (view !== ALL || searching()) select(ALL);
});

// ---- What a songbook's right-click menu does ----

/** Add Songbook… and File > Add Songbook to Library… (Shift+Cmd+O) */
async function chooseSongbook() {
  try {
    const folder = await addSongbook();
    if (!folder) return;
    library = await getLibrary();
    await selectFolder(folder);
  } catch (err) {
    showError(err);
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
    showError(err);
    return;
  }
  if (getFolder() === folder) setFolder(null);
  resetSearchIndex();
  showLibrary();
  checkFolders();
  // its songs and favorites aren't shown while it's out of the Library
  showCurrent();
}

/** Right-click > Rename… or double-click: a new name for the songbook (not the folder). */
async function renameFolder(folder) {
  try {
    const next = await renameSongbook(library, folder);
    if (!next) return;
    library = next;
  } catch (err) {
    showError(err);
    return;
  }
  resetSearchIndex(); // results say which songbook a song is from
  showLibrary();
  refresh();
}

/** Right-click > Open Folder: in Finder. */
async function openFolder(folder) {
  try {
    await revealSongbook(folder);
  } catch (err) {
    showError(err);
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
    showError(err);
    return;
  }
  favorites = await getFavorites();
  resetSearchIndex();
  await checkFolders();
  showLibrary();
  showCurrent();
}

songbooksEl.addEventListener('dblclick', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (button) renameFolder(button.dataset.folder);
});

songbooksEl.addEventListener('contextmenu', (event) => {
  const button = event.target.closest('button[data-folder]');
  if (!button) return;
  const { folder } = button.dataset;
  showContextMenu(event, [
    { label: 'Open', action: () => openFromSidebar(folder) },
    { label: 'New Song…', action: () => newSong({ folder }) },
    { label: 'Rename…', action: () => renameFolder(folder) },
    null,
    { label: 'Open Folder', action: () => openFolder(folder) },
    { label: 'Change Folder…', action: () => changeFolder(folder) },
    { label: 'Bundle all as PDF…', disabled: true }, // Phase 4
    null,
    { label: 'Remove from Library', action: () => removeFolder(folder) },
  ]);
});

// ---- The songs: stars and opening ----

/** Favorites changed: Favorites lists them again; elsewhere just the stars change. */
function favoritesChanged(next) {
  favorites = next;
  if (view === FAVORITES) refresh();
  else updateStars(listEl, starred);
}

async function toggleStar(star) {
  try {
    favoritesChanged(await starSong(star.dataset.folder, star.dataset.filename, !starIsOn(star)));
  } catch (err) {
    showError(err);
  }
}

// A song opens in its own window rather than in this one
listEl.addEventListener('click', (event) => {
  const star = event.target.closest('button.songStar');
  if (star) {
    toggleStar(star);
    return;
  }
  const link = event.target.closest('a[data-filename]');
  if (!link) return;
  event.preventDefault();
  const { folder, filename } = link.dataset;
  if (link.dataset.missing) {
    showStatus(`“${escapeText(filename)}” isn't in ${bold(songbookName(library, folder))} any more:`
      + ' it was moved, renamed or deleted outside the app. Click its ★ to take it out of Favorites.', true);
    return;
  }
  openSongbookSong(folder, filename);
});

// ---- The + menu and the app menu ----

/** File > Open… (Cmd+O): one song on its own, in its own window. */
async function chooseSong() {
  try {
    const path = await pickSongFile();
    if (path) await openSongFile(path);
  } catch (err) {
    showError(err);
  }
}

function closeTopActionMenu() {
  topActionMenu.hidden = true;
  topActionBtn.setAttribute('aria-expanded', 'false');
}
topActionBtn.addEventListener('click', () => {
  const show = topActionMenu.hidden;
  topActionMenu.hidden = !show;
  topActionBtn.setAttribute('aria-expanded', String(show));
});
topActionMenu.addEventListener('click', (event) => {
  const item = event.target.closest('button[data-action]');
  if (!item) return;
  closeTopActionMenu();
  const actions = {
    'new-song': () => newSong(),
    'open-song': chooseSong,
    'add-songbook': chooseSongbook,
  };
  actions[item.dataset.action]();
});
document.addEventListener('click', (event) => {
  if (!topActionMenu.hidden && !event.target.closest('.topAction')) closeTopActionMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeTopActionMenu();
});

onMenu('new-song', () => newSong());
// File > Add Songbook to Library… (Shift+Cmd+O; its id is from Open Songbook…) and
// Open… (Cmd+O). Save and Save As do nothing here; Quit quits.
onMenu('open-songbook', chooseSongbook);
onMenu('open-file', chooseSong);

// ---- Keeping up with changes made elsewhere ----

// Settings changed which song types to list
onSettingsChanged(() => {
  resetSearchIndex();
  showCurrent();
});

// The Library changed in another window (a songbook added from a song window's New Song…)
onLibraryChanged((next) => {
  library = next;
  resetSearchIndex();
  showLibrary();
  checkFolders();
  refresh();
});

// A song window's Edit > Open Songbook (src-tauri/src/windows.rs, show_songbook)
onEvent('studio://show-songbook', (folder) => {
  if (inLibrary(folder)) selectFolder(folder);
});

// A song was starred or unstarred (here, or in a song window)
onFavoritesChanged(favoritesChanged);

// A song was created, saved or renamed in some window: its title, artist or file
// name may have changed
onSongsChanged(({ folder }) => {
  resetSearchIndex();
  if (searching() || view !== SONGBOOK || folder === getFolder()) refresh();
});

// Coming back to this window: files may have changed outside the app meanwhile
window.addEventListener('focus', () => {
  resetSearchIndex();
  checkFolders();
  refresh();
});

// ---- Search ----

/**
 * The songs of each songbook read so far, ready for searchSongs(): folder → promise of
 * entries. A songbook is read the first time a search needs it, so searching one
 * songbook reads only that one. Emptied whenever songs may have changed.
 */
let searchIndex = new Map();

function resetSearchIndex() {
  searchIndex = new Map();
}

/** Reads one songbook's songs (an empty list if its folder can't be read). */
async function buildSongbookIndex(folder) {
  const name = songbookName(library, folder);
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
}

function songbookIndex(folder) {
  if (!searchIndex.has(folder)) searchIndex.set(folder, buildSongbookIndex(folder));
  return searchIndex.get(folder);
}

/**
 * What a search covers, from the sidebar's selection: the folders to read, which of
 * their songs count, and its name ("in Favorites"). The songbook's name is left off
 * each result when the search is of one songbook.
 */
function searchScope() {
  if (view === FAVORITES) {
    const songs = favoriteSongs(favorites).filter((s) => inLibrary(s.folder));
    return {
      folders: [...new Set(songs.map((s) => s.folder))],
      counts: (entry) => starred(entry.folder, entry.filename),
      where: 'Favorites',
      showSongbook: true,
    };
  }
  if (view === ALL) {
    return { folders: library.songbooks.map((s) => s.folder), counts: () => true, where: 'All Songs', showSongbook: true };
  }
  const open = getFolder();
  return {
    folders: open ? [open] : [],
    counts: () => true,
    where: open ? songbookName(library, open) : '',
    showSongbook: false,
  };
}

/** The search box says what it searches. */
function showSearchLabel() {
  const { where } = searchScope();
  const label = `Search ${where || 'a songbook'}`;
  searchEl.placeholder = `${label}: title, artist or lyrics`;
  searchEl.setAttribute('aria-label', label);
}

async function runSearch({ quiet = false } = {}) {
  const query = searchEl.value.trim();
  if (!query) {
    showCurrent();
    return;
  }
  const scope = searchScope();
  const where = bold(scope.where);
  if (view === SONGBOOK && !scope.folders.length) {
    startShowing('', false);
    listEl.innerHTML = '';
    showStatus('Choose a songbook in the Library to search it.');
    return;
  }
  // typing more is the same search going on: the results stay until the new ones are ready
  const isCurrent = startShowing(`Searching ${where}…`, quiet || scope.folders.every((f) => searchIndex.has(f)));
  let entries;
  try {
    entries = (await Promise.all(scope.folders.map(songbookIndex))).flat().filter(scope.counts);
  } catch (err) {
    resetSearchIndex();
    if (isCurrent()) showError(err);
    return;
  }
  if (!isCurrent()) return;
  const results = searchSongs(entries, query);
  const quoted = `“${escapeText(query)}”`;
  showStatus(results.length
    ? `${results.length === 1 ? '1 song matches' : `${results.length} songs match`} ${quoted} in ${where}`
    : `No songs in ${where} match ${quoted}.`);
  showRows(results.map(({ entry, snippet }) => ({
    folder: entry.folder,
    filename: entry.filename,
    title: entry.title,
    details: [entry.artist],
    songbook: scope.showSongbook ? entry.songbook : undefined,
    snippetHtml: snippet ? markWords(snippet, query) : '',
  })));
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
    showCurrent();
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

// ---- Starting ----

/**
 * What this window showed before a reload, else (if Settings says so) what was
 * selected last time the app ran: a songbook, Favorites or All Songs.
 */
async function showFirst() {
  await loadSettings();
  [library, favorites] = await Promise.all([getLibrary(), getFavorites()]);
  const folder = inLibrary(getFolder()) ? getFolder() : null;
  const last = getSettings().reopenLastSongbook && !folder ? library.selected : null;
  checkFolders();
  if (savedView() === FAVORITES) await select(FAVORITES);
  else if (savedView() === ALL) await select(ALL);
  else if (last === FAVORITES_SELECTED) await select(FAVORITES);
  else if (last === ALL_SELECTED) await select(ALL);
  else if (inLibrary(last)) await selectFolder(last);
  else if (folder) await selectFolder(folder);
  else {
    setFolder(null);
    showLibrary();
    showNothingOpen();
  }
}

// The song list was closed and a menu item opened it again (src-tauri/src/windows.rs):
// index.html?open=1 for File > Add Songbook to Library… (shows the picker);
// index.html?menu=new-song or menu=open-file for New Song… and Open…;
// index.html?folder=<folder> for a song window's Edit > Open Songbook.
const params = new URLSearchParams(location.search);
const showPicker = params.has('open');
const showFolder = params.get('folder');
const menuItem = params.get('menu');
if (location.search) history.replaceState(null, '', 'index.html');
showFirst().then(() => {
  if (inLibrary(showFolder)) selectFolder(showFolder);
  if (showPicker) chooseSongbook();
  else if (menuItem === 'new-song') newSong();
  else if (menuItem === 'open-file') chooseSong();
});
