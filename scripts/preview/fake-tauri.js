/**
 * A stand-in for window.__TAURI__, so the app's pages run in a plain browser
 * (`npm run preview`, see server.js). For testing the pages' own logic only: no real
 * files, dialogs or menus.
 *
 * - Files live in localStorage under "fakefs:<path>". Two songbooks are seeded:
 *   /songs (a.cpm, b.cpm) and /other (z.cpm), with /other as the recent songbook.
 * - Settings and the recent lists live in localStorage too ("fakesettings",
 *   "fakerecent").
 * - Dialogs answer from globals you set first: __nextOpen (a path, or null for
 *   Cancel), __nextSave, __nextAsk (true/false), __nextChoice (a button label for
 *   message() with custom buttons; used once).
 * - Menu items: __menu('save'), __menu('quit'), …; Open Recent: __recent({ folder,
 *   song, single }); settings changed: __settings({ ... }).
 * - Closing the window: await __close({ preventDefault() {} }).
 * - Windows: each browser tab is one. The song list is "main"; opening a song
 *   (open_song_window) opens a tab named after its path, so opening it again goes
 *   to that tab, like the app's song windows. Quit answers are logged.
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
  const listeners = {};
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
    recent_add_songbook: ({ folder }) => {
      const recent = commands.recent_list();
      recent.songbooks = [folder, ...recent.songbooks.filter((f) => f !== folder)];
      localStorage.setItem('fakerecent', JSON.stringify(recent));
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
    song_window_path: () => {},
  };

  // the app's window labels: "main" for the song list, "song-N" for songs
  if (!window.name) window.name = location.pathname.endsWith('editor.html') ? 'song:?' : 'main';
  const appWindow = {
    label: window.name === 'main' ? 'main' : 'song-1',
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
        listeners[name] = callback;
        return () => {};
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

  window.__menu = (id) => listeners['studio://menu']({ payload: id });
  window.__recent = (payload) => listeners['studio://open-recent']({ payload });
  window.__settings = (payload) => listeners['studio://settings']({ payload });

  if (!localStorage.getItem(`${LS}/songs/a.cpm`)) {
    localStorage.setItem(`${LS}/songs/a.cpm`, '{title: Alpha}\n[C]Hello [G]world');
    localStorage.setItem(`${LS}/songs/b.cpm`, '{title: Beta}\n[F]Hi');
    localStorage.setItem(`${LS}/other/z.cpm`, '{title: Zed}\n[C]z');
    localStorage.setItem('fakerecent', JSON.stringify({ songbooks: ['/other'], songs: [] }));
  }
})();
