/**
 * A stand-in for window.__TAURI__, so the app's pages run in a plain browser
 * (`npm run preview`, see server.js). For testing the pages' own logic only: no real
 * files, dialogs or menus.
 *
 * - Files live in localStorage under "fakefs:<path>". Two songbooks are seeded:
 *   /songs (a.cpm, b.cpm) and /other (z.cpm), both in the Library, /other selected.
 * - Settings, the recent lists, the Library and Favorites live in localStorage too
 *   ("fakesettings", "fakerecent", "fakelibrary", "fakefavorites"). Starring tells
 *   every open tab (a "storage" event), as Rust tells every window.
 * - Add Songbook: set __nextOpen to a folder first (one with files, like /songs).
 * - Dialogs answer from globals you set first: __nextOpen (a path, or null for
 *   Cancel), __nextSave, __nextAsk (true/false), __nextChoice (a button label for
 *   message() with custom buttons; used once).
 * - Menu items: __menu('save'), __menu('quit'), …; settings changed:
 *   __settings({ ... }). (Open Recent's songs open windows from Rust: not faked.)
 * - Closing the window: await __close({ preventDefault() {} }).
 * - Windows: each browser tab is one. The song list is "main"; opening a song
 *   (open_song_window) opens a tab named after its path, so opening it again goes
 *   to that tab, like the app's song windows. Quit answers are logged.
 * - The Edit window (open_edit_window) opens a tab too, "edit-1" to the song tab's
 *   "song-1": events sent to one window (emitTo) reach the tab with that label, so
 *   try it with one song tab open. Closing the Edit tab tells the song tab.
 * - Everything the pages ask Tauri to do is logged in window.__log.
 *
 * In the console, for example:
 *   sessionStorage.setItem('studio.songbookFolder', '/songs'); location.href = 'editor.html?song=a.cpm';
 */
(() => {
  const LS = 'fakefs:';
  const log = (...args) => {
    (window.__log = window.__log || []).push(args.map(String).join(' '));
    console.log('[fake tauri]', ...args);
  };
  const listeners = {}; // event name -> callbacks, as Tauri allows several
  const emit = (name, payload) => (listeners[name] || []).forEach((callback) => callback({ payload }));
  const read = (key, fallback) => JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));

  const fs = {
    async readDir(dir) {
      const prefix = `${LS}${dir}/`;
      return Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix) && !key.slice(prefix.length).includes('/'))
        .map((key) => ({ name: key.slice(prefix.length), isFile: true }));
    },
    async stat(path) {
      const text = localStorage.getItem(LS + path);
      if (text == null) throw `no such file: ${path}`;
      return { size: text.length, mtime: new Date(0) };
    },
    async readTextFile(path) {
      const text = localStorage.getItem(LS + path);
      if (text == null) throw `no such file: ${path}`;
      return text;
    },
    async writeTextFile(path, text, options = {}) {
      if (options.createNew && localStorage.getItem(LS + path) != null) throw `exists: ${path}`;
      log('write', path);
      localStorage.setItem(LS + path, text);
    },
    async rename(from, to) {
      log('rename', from, to);
      localStorage.setItem(LS + to, localStorage.getItem(LS + from));
      localStorage.removeItem(LS + from);
    },
    async remove(path) {
      log('remove', path);
      localStorage.removeItem(LS + path);
    },
  };

  // the app's own Rust commands (src-tauri/src/*.rs)
  const commands = {
    recent_list: () => read('fakerecent', { songbooks: [], songs: [] }),
    library_get: () => read('fakelibrary', { songbooks: [], selected: null }),
    library_add: ({ folder, name }) => {
      const library = commands.library_get();
      const songbook = library.songbooks.find((s) => s.folder === folder);
      if (songbook) songbook.name = name;
      else library.songbooks.push({ folder, name });
      library.selected = folder;
      return saveLibrary(library);
    },
    library_rename: ({ folder, name }) => {
      const library = commands.library_get();
      library.songbooks.find((s) => s.folder === folder).name = name;
      return saveLibrary(library);
    },
    library_remove: ({ folder }) => {
      const library = commands.library_get();
      library.songbooks = library.songbooks.filter((s) => s.folder !== folder);
      if (library.selected === folder) library.selected = null;
      return saveLibrary(library);
    },
    library_change_folder: ({ folder, to }) => {
      const library = commands.library_get();
      if (library.songbooks.some((s) => s.folder === to)) throw 'That folder is already a songbook in the Library.';
      library.songbooks.find((s) => s.folder === folder).folder = to;
      if (library.selected === folder) library.selected = to;
      const favorites = commands.favorites_get();
      for (const list of favorites.lists) list.songs.forEach((s) => { if (s.folder === folder) s.folder = to; });
      saveFavorites(favorites);
      return saveLibrary(library);
    },
    library_reveal: ({ folder }) => log('reveal folder', folder),
    library_select: ({ folder }) => saveLibrary({ ...commands.library_get(), selected: folder }),
    favorites_get: () => read('fakefavorites', { lists: [{ id: 'favorites', name: 'Favorites', songs: [] }] }),
    favorites_star: ({ folder, file, starred }) => {
      if (starred && !commands.library_get().songbooks.some((s) => s.folder === folder)) {
        throw `not a songbook in the Library: ${folder}`;
      }
      const favorites = commands.favorites_get();
      const list = favorites.lists.find((l) => l.id === 'favorites');
      const is = (s) => s.folder === folder && s.file === file;
      if (!starred) list.songs = list.songs.filter((s) => !is(s));
      else if (!list.songs.some(is)) list.songs.push({ folder, file });
      return saveFavorites(favorites);
    },
    favorites_rename: ({ folder, from, to }) => {
      const favorites = commands.favorites_get();
      for (const list of favorites.lists) {
        const has = (f) => list.songs.some((s) => s.folder === folder && s.file === f);
        if (has(to)) list.songs = list.songs.filter((s) => !(s.folder === folder && s.file === from));
        else list.songs.forEach((s) => { if (s.folder === folder && s.file === from) s.file = to; });
      }
      return saveFavorites(favorites);
    },
    recent_add_song: (song) => {
      const recent = commands.recent_list();
      recent.songs = [song, ...recent.songs.filter((s) => !(s.folder === song.folder && s.filename === song.filename))];
      localStorage.setItem('fakerecent', JSON.stringify(recent));
    },
    settings_get: () => read('fakesettings', {
      songExtensions: ['.cpm'], reopenLastSongbook: true, fileNaming: 'title-artist', renameWithTitle: true,
    }),
    settings_set: ({ settings }) => {
      localStorage.setItem('fakesettings', JSON.stringify(settings));
      return settings;
    },
    save_song_file: ({ path, text }) => {
      localStorage.setItem(LS + path, text);
    },
    print_page: () => {},
    quit: () => {},
    quit_cancel: () => {},
    open_song_window: ({ path, url }) => { window.open(url, `song:${path}`); },
    open_edit_window: () => { window.open('edit-window.html', 'edit:1'); },
    show_songbook: ({ folder }) => emitTo('main', 'studio://show-songbook', folder),
    song_window_path: () => {},
  };

  // the app's window labels: "main" for the song list, "song-N" for songs
  if (!window.name) {
    const page = location.pathname.split('/').pop();
    window.name = { 'editor.html': 'song:?', 'edit-window.html': 'edit:1' }[page] || 'main';
  }
  const label = window.name === 'main' ? 'main' : (window.name.startsWith('edit:') ? 'edit-1' : 'song-1');
  // an event for one window (emitTo): this tab if it's the one, else the others hear of it
  const emitTo = (target, name, payload) => {
    if (target === label) emit(name, payload);
    else localStorage.setItem('fakeevent', JSON.stringify({ name, payload, target, when: Date.now() }));
  };
  // as Rust tells a song window that its Edit window closed
  if (label === 'edit-1') window.addEventListener('pagehide', () => emitTo('song-1', 'studio://edit-closed'));
  function saveLibrary(library) {
    localStorage.setItem('fakelibrary', JSON.stringify(library));
    emit('studio://library', library);
    return library;
  }

  function saveFavorites(favorites) {
    localStorage.setItem('fakefavorites', JSON.stringify(favorites));
    emit('studio://favorites', favorites);
    return favorites;
  }
  // other tabs (song windows) hear about it too
  window.addEventListener('storage', (event) => {
    if (event.key === 'fakefavorites') {
      emit('studio://favorites', JSON.parse(event.newValue));
    }
    if (event.key === 'fakeevent' && event.newValue) {
      const { name, payload, target } = JSON.parse(event.newValue);
      if (!target || target === label) emit(name, payload);
    }
  });

  const appWindow = {
    label,
    async setTitle(title) { log('title', title); },
    async onCloseRequested(callback) { window.__close = callback; },
    async destroy() { log('destroy'); },
    async close() { log('close'); if (window.__close) await window.__close({ preventDefault() { log('close prevented'); } }); },
  };

  window.__TAURI__ = {
    core: {
      async invoke(command, args) {
        log('invoke', command, JSON.stringify(args || {}));
        if (!commands[command]) throw `unknown command: ${command}`;
        return commands[command](args || {});
      },
    },
    event: {
      async listen(name, callback) {
        (listeners[name] = listeners[name] || []).push(callback);
        return () => {};
      },
      // a page's own event (studio://songbook-songs): this tab and, through a
      // "storage" event, the others
      async emit(name, payload) {
        log('emit', name, JSON.stringify(payload));
        emit(name, payload);
        localStorage.setItem('fakeevent', JSON.stringify({ name, payload, when: Date.now() }));
      },
      async emitTo(target, name, payload) {
        log('emitTo', target, name, JSON.stringify(payload));
        emitTo(target, name, payload);
      },
    },
    dialog: {
      async open(options) { log('open dialog', JSON.stringify(options)); return window.__nextOpen ?? null; },
      async save(options) { log('save dialog', JSON.stringify(options)); return window.__nextSave ?? null; },
      async ask(message) { log('ask', message); return window.__nextAsk ?? true; },
      async message(message, options) {
        log('message', message, JSON.stringify((options && options.buttons) || null));
        const choice = window.__nextChoice;
        window.__nextChoice = undefined;
        return choice;
      },
    },
    fs,
    window: { getCurrentWindow: () => appWindow },
  };

  window.__menu = (id) => emit('studio://menu', id);
  window.__settings = (payload) => emit('studio://settings', payload);

  if (!localStorage.getItem(`${LS}/songs/a.cpm`)) {
    localStorage.setItem(`${LS}/songs/a.cpm`, '{title: Alpha}\n[C]Hello [G]world');
    localStorage.setItem(`${LS}/songs/b.cpm`, '{title: Beta}\n[F]Hi');
    localStorage.setItem(`${LS}/other/z.cpm`, '{title: Zed}\n[C]z');
    localStorage.setItem('fakerecent', JSON.stringify({ songbooks: [], songs: [] }));
  }
  if (!localStorage.getItem('fakelibrary')) {
    localStorage.setItem('fakelibrary', JSON.stringify({
      songbooks: [{ folder: '/songs', name: 'songs' }, { folder: '/other', name: 'other' }], selected: '/other',
    }));
  }
})();
