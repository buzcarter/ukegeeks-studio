# Handoff: after the Library

Written 2026-11-07 (late), after the Library work (tasks 0013, 0016, 0017, 0020–0022) reached `main`; refreshed from the handoff written after Phase 2.5. Read [CLAUDE.md](../CLAUDE.md) first (how the owner works), then [BOARD.md](BOARD.md) (what's next), [DECISIONS.md](DECISIONS.md) (why things are the way they are) and [ROADMAP.md](ROADMAP.md) (the phases). [CHANGELOG.md](../CHANGELOG.md) has every PR.

## Where things stand

UkeGeeks Studio is a working Mac app, run from source with `npm run dev`. Nothing is released or bundled yet.

- **The Library (main window):**
  - A sidebar of songbooks: folders added with Add Songbook to Library… (Shift+Cmd+O, +, or the header's Add Songbook…), each with a name the player gives it (folders are often just "songs" or "cpm"). Kept in `library.json`.
  - Right-click a songbook: Open, New Song… (in that songbook), Rename… (or double-click), Remove from Library (or −; the folder stays on disk).
  - The selected songbook's songs, sorted like the Songbook. It's selected again at launch.
  - **Search** (Cmd+F, the box above the songs): every songbook, by title, artist or lyrics (chords ignored). Results show their songbook and a lyric line.
  - **Favorites** (task 0018): a ☆ beside every song (and in a song window's corner bar) stars it; Favorites, at the top of the sidebar, lists starred songs from every songbook. Kept in `favorites.json`, as lists, ready for set lists.
- **Song windows:** each song opens in its own window (or comes forward if open). Its corner bar shows the songbook's name and a Close button. File > Open Recent lists the last 10 songs.
- **On a Mac** the app stays running with no windows; the Dock icon brings back the Library.
- **Songs:**
  - The Song-a-Matic editor (`@ukegeeks/song-editor`) edits a song.
  - Save (Cmd+S) writes it; Save As… (Shift+Cmd+S) saves under a new name.
  - New Song… (Cmd+N) and Open… (Cmd+O, one song on its own, outside a songbook).
  - Print… (Cmd+P).
  - File names follow titles: saving a song whose title or artist changed renames its file, never over another.
- **Unsaved changes:** "Edited" in the window title. Closing the window or quitting asks Save & … / Discard Edits / Continue Editing; Quit asks each song window in turn. Save says where it saved ("Saved x.cpm in Beach Party").
- **Settings** (Cmd+,): which song file types to list, how files are named, renaming on/off, selecting the last songbook at launch.
- **Menus:** File, Edit, View, Window and Help, laid out per OS. The editor keeps its own controls.
- **Look:** the Song-a-Matic's faux-wood look on the app's own pages and dialogs (`web/css/wood.css`).

Phase 2.5 is done, and so is the Library from the owner's user stories (DECISIONS.md, "The Library and song windows"), Favorites included. **Next on the board: task 0019, a first-run welcome/tour.** Set lists (Favorites' follow-up) are under Later.

## How the code is laid out

| Where | What |
|---|---|
| `web/index.html`, `web/js/list.js` | The song list. |
| `web/editor.html`, `web/js/editor.js` | The editor page, one per song window: `?folder=<folder>&song=<file>` for a songbook's song, `?file=<path>` for a song on its own. One song per page (the editor finds its parts by id). |
| `web/settings.html`, `web/js/settings.js` | The Settings window. It doesn't load `menu.js`, on purpose. |
| `web/js/songbook.js` | The open folder, settings, recent lists, paths, and the Tauri helpers the pages share. |
| `web/js/songs.js` | `SongRepository` and the ChordPro parsing, from the Songbook's `server/lib/songs.js`. Tested in `test/songs.test.js`. |
| `web/js/menu.js` | Menu events from Rust → `onMenu(id, handler)`. |
| `web/js/new-song.js`, `web/css/dialog.css` | The New Song dialog (the page's own `<dialog>`). |
| `web/css/wood.css` | The faux-wood look. |
| `src-tauri/src/lib.rs` | The menu and where its items go, the `save_song_file` and `print_page` commands, and Dock > Quit. |
| `src-tauri/src/windows.rs` | The song windows (`open_song_window`, `song_window_path`), menu items to the window in front, Show Song List (`show_main`), and Quit asking each song window in turn (`quit`, `quit_cancel`). |
| `src-tauri/src/favorites.rs` | Favorites, kept in `favorites.json` as lists of `{ folder, file }` (one list today): star, unstar, follow a rename. Rust unit tests. |
| `src-tauri/src/library.rs` | The Library, kept in `library.json`: songbooks (`{ folder, name }`), the one selected last; folders allowed again at launch. Rust unit tests: `cargo test` in `src-tauri/`. |
| `web/js/songbook-name.js` | The Songbook Name dialog (adding a songbook, Rename…). |
| `web/js/search.js` | Searching the Library: lyrics without chords, folding case and accents, ranking. Plain functions, tested in `test/search.test.js`; `list.js` reads the songs and shows the results. |
| `src-tauri/src/recent.rs`, `settings.rs` | Open Recent (songs) and Settings, kept in `recent.json` and `settings.json` in `~/Library/Application Support/org.ukegeeks.studio/`. |
| `src-tauri/capabilities/default.json` | What the main window may do. Its description says why each permission is there. |
| `scripts/vendor.js` | Copies the @ukegeeks packages into `web/vendor/` (not committed). |
| `scripts/preview/` | `npm run preview`: the pages in a browser with a fake Tauri. |

## How to test

- **`npm test`:** `SongRepository` and the ChordPro parsing, and search (19 tests). `cargo test` in `src-tauri/` has the Library's and Favorites' (7).
- **`npm run preview`:** serves `web/` on http://localhost:8765 with a stand-in for `window.__TAURI__` (`scripts/preview/fake-tauri.js`). Files live in localStorage, and dialogs answer from globals (`__nextOpen`, `__nextSave`, `__nextChoice`, …). Drive menu items with `__menu('save')`, and read what the page asked Tauri to do in `__log`. Open it in Claude Code's browser pane. The fake's header comment explains it all.
- **The preview server reads `fake-tauri.js` once at start:** after changing it, stop and start the preview. Its seeded data lives in the browser's localStorage (`fakefs:…`, `fakelibrary`, …); clear a key to reseed it.
- **The real app:** Claude Code's screen tools can't target a dev build's window, because it's a bare binary, not an `.app`. So test the pages with `npm run preview`, build and briefly launch the binary to catch startup errors, then ask the owner to try it, saying exactly what to click. Launch it as `./target/debug/ukegeeks-studio & pid=$!; sleep 6; kill $pid`. **Never `pkill` by name:** that also kills the owner's own `npm run dev`, which runs the same binary. Put the launch on a line of its own, not after `cd … && cargo build &&`: there `&` backgrounds the whole chain and `$!` is a subshell, not the app. The owner's `tauri dev` also rebuilds and restarts on Rust edits, so their running app may already have the branch's code.
- **Port 8765 taken** (another chat's preview): the server reads `PORT`, so `PORT=8766 npm run preview` works.
- **Commands for the owner:** the desktop app's `!` shell doesn't load their profile, so cargo isn't on its PATH. Give them `cd ~/Code/ukegeeks-studio && PATH="$HOME/.cargo/bin:$PATH" npm run dev`.
- **Windows:** the Windows menu code (`cfg(not(target_os = "macos"))`) has never been compiled; only the Mac target is installed.

## Tauri lessons (2.12.5; checked, don't relearn)

- **Page scripts:** `web/` is plain static files with no bundler. `app.withGlobalTauri` gives `window.__TAURI__.{core,dialog,fs,window,event}`, and the pages are ES modules.
- **Folder access:**
  - The Open dialog grants the picked folder plus the files directly in it, for one run of the app. That grant doesn't cover dotfiles on macOS, which is why temp files are `<song>.<hex>.ugs-tmp`.
  - The Save dialog grants just the chosen file. Writing next to such a file goes through Rust (`save_song_file`).
  - Recent folders are granted again at startup by `recent.rs`.
- **App commands:** commands the app defines itself (`#[tauri::command]`) need no capability for local pages. Plugin and core commands do. Check permission names in `~/.cargo/registry/src/*/tauri-plugin-*-2.*/permissions/` and the tauri crate's `permissions/`, rather than guessing.
- **No windows on a Mac:** `RunEvent::ExitRequested { code: None }` comes when the last window closes; `prevent_exit()` keeps the app running. `RunEvent::Reopen { has_visible_windows }` (Mac only) is the Dock icon click.
- **Quitting:** the built-in Quit item and Dock > Quit (NSApp `terminate:`) end the app with no event. Quit is therefore a custom item that asks the page first, and Dock > Quit is caught by adding `applicationShouldTerminate:` to tao's app delegate. `RunEvent::ExitRequested { code: None }` only comes when the last window closes.
- **Closing:** once a page listens with `onCloseRequested`, the window closes only through `destroy()`.
- **Dialogs:** `dialog.message()` with `buttons: { yes, no, cancel }` returns the clicked label, and Esc returns the cancel label. `dialog.ask` uses the `dialog:allow-message` permission.
- **The page's own `<dialog>`:** its `close` event can come late or not at all in a background page, so answer from submit, `cancel` and button clicks instead.
- **Printing:** `window.print()` on a Mac prints with zero margins, which printers clip. `print_page` opens WKWebView's print sheet with half-inch margins.
- **Unsaved changes:** the dirty check compares with the editor's own text right after mount, not the file's, because the Edit Song box decodes HTML entities.
- **Fullscreen:** while it's open, Ace's editor sits outside the editor's container, and `getSong()` doesn't see its text; `editor.js` reads Ace directly.
- **Menu:** it's built in `setup()` (so Open Recent can be rebuilt), and menu calls are safe from any thread.
- **Events to one window:** `emit_to(label, …)` still reaches every page that listens with a plain `listen()`, which hears events sent to any target. Listen with `{ target: { kind: 'AnyLabel', label } }` to get only your window's events (and still the global ones from `emit`).
- **Window URLs:** `WebviewUrl::App("editor.html?x=1")` keeps the query string (it's joined onto the app URL).
- **Rust dependencies:** `objc2`, `serde` and `serde_json` are direct dependencies, but Tauri already builds them, so they cost nothing extra.

## Disk

About 10 GB free on 2026-11-07, with `src-tauri/target/` at 2.3 GB. Incremental dev builds take seconds. Say so before release builds or new Rust targets, and offer `cargo clean` in `src-tauri/` when space gets tight.

## Working notes from the last session

- **Merges:** the owner sometimes pushes a finished branch straight to `main` instead of opening a PR (tasks 0016, 0017, 0022), and deletes branches after merging. So check `git fetch` and `gh pr list` before assuming what's merged, and cut each new branch from `origin/main`.
- **PR numbers** in BACKLOG.md and CHANGELOG.md are a guess (the next number) until GitHub assigns one; fix them when they turn out different.
- **Two open branches that both add a row to the board and a CHANGELOG entry** conflict; stack the second on the first and say which to merge first.

## Open threads

- **Set lists** (after Favorites): named lists in the player's own order. `favorites.json` already keeps lists; it needs making, renaming and reordering them, and a sidebar section.
- **Task 0019, first-run welcome/tour:** after Favorites, so it shows the app as it will be.
- **Duplicate a songbook** (on the board under Later): the owner floated it with a "?"; confirm what's meant first. Copying needs somewhere the app may write.
- **Not tried in the real app by the owner yet,** as far as this session knows: search, the songbook right-click menu, songbook names, staying open on a Mac, and Favorites. Ask how they went.
- **Phase 3:** add a song from a pasted songsheet, using the editor's `ugsEditorPlus.reformat`.
- **Phase 5 work that's already visible:**
  - The dev build has no app icon; dialogs show a folder icon.
  - Double-clicking a `.cpm` in Finder should open it, through a file association and the existing `editor.html?file=` page.
- **The song-editor TypeScript conversion** happens in another repo (`~/Code/ukegeeks-unnamed-editor-project`). Don't touch it from here; when a new `@ukegeeks/song-editor` is published, updating it here is its own task.
