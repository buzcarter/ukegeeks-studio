# Handoff: after the Library

Written 2026-11-07 (late), after the Library work (tasks 0013, 0016, 0017, 0020–0022) reached `main`; refreshed from the handoff written after Phase 2.5. Read [CLAUDE.md](../CLAUDE.md) first (how the owner works), then [BACKLOG.md](BACKLOG.md) (what's next), [DECISIONS.md](DECISIONS.md) (why things are the way they are) and [ROADMAP.md](ROADMAP.md) (the phases). [CHANGELOG.md](../CHANGELOG.md) has every PR.

## Where things stand

UkeGeeks Studio is a working Mac app, run from source with `npm run dev`. Nothing is released or bundled yet.

- **The Library (main window):**
  - A sidebar of songbooks: folders added with Add Songbook to Library… (Shift+Cmd+O, +, or the header's Add Songbook…), each with a name the player gives it (folders are often just "songs" or "cpm"). Kept in `library.json`.
  - Right-click a songbook: Open, New Song… (in that songbook), Rename… (or double-click), Open Folder, Change Folder…, Bundle all as PDF… (disabled until Phase 4) and Remove from Library (asks first; the folder stays on disk). All Songs, under Favorites, lists every song; a red "!" marks a songbook whose folder can't be read (UGS-0031).
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

Reorganised on 2026-11-11 (UGS-0032). The pages are plain ES modules with no bundler; a page script wires its page together, and what the pages share is in `web/js/lib/`.

| Where | What |
|---|---|
| `web/index.html`, `web/js/list.js` | The song list and the Library sidebar. What the list shows is a search's results, else the sidebar's selection (`view`: a songbook, Favorites or All Songs). |
| `web/editor.html`, `web/js/editor.js` | The editor page, one per song window: `?folder=<folder>&song=<file>` for a songbook's song, `?file=<path>` for a song on its own. One song per page (the editor finds its parts by id). |
| `web/settings.html`, `web/js/settings.js` | The Settings window. It doesn't load `lib/menu.js`, on purpose. |
| `web/js/lib/tauri.js` | The way to Tauri: `tauri()`, `invoke()`, `onEvent()`, `errorMessage()`, `showProblem()`. |
| `web/js/lib/songs.js` | `SongRepository` and the ChordPro parsing, from the Songbook's `server/lib/songs.js`. Tested in `test/songs.test.js`. |
| `web/js/lib/songbook.js` | The songbook open in this window, its `SongRepository` (one kept per folder), opening songs in their windows, and the "songs changed" event (`notifySongsChanged`, `onSongsChanged`). |
| `web/js/lib/library.js`, `favorites.js`, `app-settings.js` | The pages' side of `library.rs`, `favorites.rs` and `settings.rs`: read, change, hear about changes. |
| `web/js/lib/search.js` | Searching the Library: lyrics without chords, folding case and accents, ranking, marking the words. Plain functions, tested in `test/search.test.js`. |
| `web/js/lib/paths.js`, `html.js` | Path helpers; `escapeHtml` (song text: keeps entities like `&copy;`) and `escapeText` (paths, names, anything read back from a `data-` attribute). |
| `web/js/lib/menu.js` | Menu events from Rust → `onMenu(id, handler)`. |
| `web/js/dialogs/` | The pages' own `<dialog>`s: New Song and Songbook Name, on `form-dialog.js`. Styled by `web/css/dialog.css`. |
| `web/js/ui/` | Pieces of the song list: `song-rows.js` (a row, its star) and `context-menu.js` (the right-click menu). |
| `web/css/wood.css` | The faux-wood look. |
| `src-tauri/src/lib.rs` | Startup only: plugins, commands, state, and staying open on a Mac. |
| `src-tauri/src/menu.rs` | The menu and where its items go; the Help pages. |
| `src-tauri/src/windows.rs` | The song windows (`open_song_window`, `song_window_path`), menu items to the window in front, Show Song List (`show_main`), and Quit asking each song window in turn (`quit`, `quit_cancel`). |
| `src-tauri/src/store.rs` | Reads and writes the app's JSON files in `~/Library/Application Support/org.ukegeeks.studio/`: temp file then rename; a file that isn't valid JSON is set aside as `<name>.unreadable.json`, never overwritten. |
| `src-tauri/src/library.rs` | The Library, kept in `library.json`: songbooks (`{ folder, name }`), the one selected last; folders allowed again at launch. |
| `src-tauri/src/favorites.rs` | Favorites, kept in `favorites.json` as lists of `{ folder, file }` (one list today): star, unstar, follow a rename. |
| `src-tauri/src/recent.rs`, `settings.rs` | Open Recent (songs) and Settings, kept in `recent.json` and `settings.json`. |
| `src-tauri/src/song_file.rs`, `print.rs`, `dock_quit.rs` | `save_song_file` (a song outside a songbook folder), `print_page` (a Mac print sheet with margins), and Dock > Quit asking about unsaved changes (Mac). |
| `src-tauri/src/paths.rs`, `platform.rs` | `same_path`, `folder_name`; opening a folder or web page with the OS. |
| `src-tauri/capabilities/default.json` | What the main window may do. Its description says why each permission is there. |
| `scripts/vendor.js` | Copies the @ukegeeks packages into `web/vendor/` (not committed). |
| `scripts/preview/` | `npm run preview`: the pages in a browser with a fake Tauri. |

## How to test

- **`npm test`:** `SongRepository` and the ChordPro parsing, search, and the pages' plain helpers (29 tests). `cargo test` in `src-tauri/` has the Library's, Favorites', the store's and the paths' (13).
- **`npm run lint`:** ESLint over the pages, tests and scripts. CI (`.github/workflows/ci.yml`) runs lint and both test suites on every PR.
- **`npm run preview`:** serves `web/` on http://localhost:8765 with a stand-in for `window.__TAURI__` (`scripts/preview/fake-tauri.js`). Files live in localStorage, and dialogs answer from globals (`__nextOpen`, `__nextSave`, `__nextChoice`, …). Drive menu items with `__menu('save')`, and read what the page asked Tauri to do in `__log`. Open it in Claude Code's browser pane. The fake's header comment explains it all.
- **The preview server reads `fake-tauri.js` once at start:** after changing it, stop and start the preview. Its seeded data lives in the browser's localStorage (`fakefs:…`, `fakelibrary`, …); clear a key to reseed it.
- **The real app:** Claude Code's screen tools can't target a dev build's window, because it's a bare binary, not an `.app`. So test the pages with `npm run preview`, build and briefly launch the binary to catch startup errors, then ask the owner to try it, saying exactly what to click. Launch it as `./target/debug/ukegeeks-studio & pid=$!; sleep 6; kill $pid`. **Never `pkill` by name:** that also kills the owner's own `npm run dev`, which runs the same binary. Put the launch on a line of its own, not after `cd … && cargo build &&`: there `&` backgrounds the whole chain and `$!` is a subshell, not the app. The owner's `tauri dev` also rebuilds and restarts on Rust edits, so their running app may already have the branch's code.
- **Port 8765 taken** (another chat's preview): the server reads `PORT`, so `PORT=8766 npm run preview` works.
- **Commands for the owner:** the desktop app's `!` shell doesn't load their profile, so cargo isn't on its PATH. Give them `cd ~/Code/UkeGeeks/ugs-ukegeeks-studio && PATH="$HOME/.cargo/bin:$PATH" npm run dev`.
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
- **Unsaved changes:** the editor's `onChange` says when the song changed; the dirty check compares `editor.getSong()` with the text right after mount (not the file's: a text box turns Windows line endings into `\n`). No timer.
- **The editor's API only:** `editor.js` uses `mount()`'s `save`/`onChange` options and `editor.getSong()`/`editor.save()` (which cover Fullscreen too). Don't reach into the editor's page; its markup changes between versions.
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
- **The editor is Buz's again** (2026-11-11; `~/Code/UkeGeeks/ugs-editor`). UGS-0034 gave the editor a host API and made 2.0.0-beta.1; Studio's editor page is written for it. Until the owner publishes it, `package.json` still says 1.0.0-beta.1: to run this branch, `npm install --no-save <the tarball from npm pack in ugs-editor>` then `npm run vendor`. After the publish: set the version in `package.json`, `npm install`, commit both files.

## From the code review (2026-11-11, UGS-0032)

Done in UGS-0034: Studio no longer reaches into the editor's page, and song titles with entities are no longer rewritten on save (the editor's box keeps the exact text). Done in UGS-0032: the reorganisation above, the shared JSON store, lint and CI, and three bugs (a stale song list after a save renamed a file, names holding HTML entities, a parse cache that never hit). Still open, most important first:

- **A window title shows a song title's entities as typed** (`Rock &amp; Roll`); the song list shows `Rock & Roll`. Decode for the title bar.
- **Open Recent forgets songs on an unplugged drive:** `recent.rs` drops entries whose file is missing at launch, and the next save makes that permanent. The Library keeps such songbooks; Recent should too (hide, don't drop).
- **The Windows menu and paths have never been compiled or run.** CI only runs `cargo test` on macOS; add a `windows-latest` job when Windows work starts (Phase 5).
- **No type checking of the pages.** `// @ts-check` with a `jsconfig.json` and the Tauri API's types would catch wrong command arguments; the editor's 2.0 types (`@ukegeeks/song-editor/browser`) can be used too.
- **`cargo clippy` and `cargo fmt` aren't installed** on this machine (`rustup component add clippy rustfmt`), so neither has been run. The code uses 2-space indentation, which needs a `rustfmt.toml` (`tab_spaces = 2`, `max_width = 120`) before `cargo fmt` is safe to run.
- **`npm audit`** reports a moderate advisory in `minimatch`, which only ESLint (a dev tool) uses; it goes away when ESLint updates.
