# Changelog

What changed in UkeGeeks Studio, newest first, one entry per pull request. Nothing is released yet: the app runs from source (`npm run dev`), version 0.1.0. Task numbers refer to [docs/BOARD.md](docs/BOARD.md).

## Unreleased

### Task 0018: Favorites (#20, 2026-11-07)

- **A ☆ beside every song** in a songbook's list and in search results, and in a song window's corner bar: click it to star the song (★), again to unstar it.
- **Favorites, at the top of the Library sidebar,** lists the starred songs of every songbook, sorted by title, each with its songbook. It's selected again at launch if it was last time (the "Select the songbook I used last" setting).
- **Library songs only:** a song opened on its own (File > Open…) has no star. A songbook taken out of the Library hides its favorites; adding it back brings them back.
- **Renames:** when Save renames a starred song's file (its title changed), it stays starred. Save As makes a new song, which starts unstarred. A favorite whose file was moved or deleted outside the app shows as "not found"; its ★ takes it out.
- **`favorites.json`,** kept by Rust (`src-tauri/src/favorites.rs`) next to `library.json`. It's kept as lists of songs with one list today, so set lists in an order of the player's own can come later without converting anything. Rust unit tests (`cargo test`).
- **`npm run preview`:** the fake Tauri knows the favorites commands, tells other tabs when a star changes, and keeps several listeners per event, as Tauri does.

### Task 0023: a new handoff (#19, 2026-11-07)

- **docs/HANDOFF.md** rewritten for the state after the Library: what the app does now, testing notes (restart the preview after changing the fake, launch the dev build by PID, the `!` shell's PATH), working notes, open threads.
- **Board and changelog:** tasks 0017 and 0022 went to `main` directly, not through PRs.

### Task 0017: search the Library (pushed to main, 2026-11-07)

- **A search box above the song list** (Cmd+F) searches every songbook in the Library by title, artist or lyrics. Esc, clearing it, or choosing a songbook goes back to the songbook.
- **Lyrics without chords:** "hello world" finds "[C]Hello [G]world"; directives, comments and tabs are skipped. Case, accents and curly quotes don't matter.
- **Every word must match;** title matches rank first, then artist, then lyrics.
- **Results** show their songbook, and for a lyric match the line with the words marked. A result opens in its own window, from its own songbook.
- **`web/js/search.js`** with 5 Node tests (`test/search.test.js`); `npm test` quiets Node's warning about loading it as an ES module.

### Task 0022: a songbook's right-click menu (pushed to main, 2026-11-07)

- **Right-click a songbook in the Library:** Open, New Song…, Rename…, and Remove from Library.
- **New Song… there** creates the song in that songbook, whichever one is open.
- **The menu stays inside the window** near its edges.
- **Board:** Duplicate a songbook is under Later, to talk through first.

### Task 0021: songbook names (#18, 2026-11-07)

- **Adding a songbook asks for its name.** Folders are often just "songs" or "cpm", so the suggestion is the parent folder's name when the folder's is a plain one or another songbook has it. Picking a folder that's already in the Library offers to rename it.
- **Rename…:** right-click a songbook, or double-click it. The folder on disk keeps its name.
- **The name is used everywhere:** the sidebar, the song list's heading, a song window's corner bar ("Songbook: Hawaiian Classics"), Save's message and the New Song dialog. Song windows follow a rename.
- **`library.json`** keeps `{ folder, name }`; plain folder entries from before still read, named after their folder. Rust unit tests for that (`cargo test`).
- **`web/js/songbook-name.js`:** the Songbook Name dialog.

### Task 0020: on a Mac, stay running with no windows (#17, 2026-11-07)

- **Closing the last window no longer quits on a Mac;** Quit (Cmd+Q, or from the Dock) does. Clicking the Dock icon with no windows showing brings back the Library.
- **New Song… and Open… with no windows** open the Library first, which then shows the New Song dialog or the Open dialog (`index.html?menu=…`).
- **Settings** stays open on a Mac when the last other window closes.
- **Elsewhere** (Windows), closing the last window still quits, as before.

### Task 0013: the Library (#16, 2026-11-07)

- **The Library sidebar:** the main window lists the songbooks you added, by name (two with the same name show their parent folder). Click one to list its songs; it's selected again at the next launch (Settings: "Select the songbook I used last").
- **Adding:** File > Add Songbook to Library… (Shift+Cmd+O; it was Open Songbook…), the + under the sidebar, or the header's Add Songbook…. New Song… with no songbook selected adds one first.
- **Removing:** − under the sidebar, or right-click a songbook > Remove from Library. The folder and its songs stay on disk.
- **`src-tauri/src/library.rs`:** `library.json` with the folders and the one selected last; the folders are allowed again at launch; only folders the Open dialog allowed can be added. Every window hears when it changes (`studio://library`).
- **Open Recent lists songs only.** The first time, the Library starts from its songbooks.
- **`npm run preview`:** the fake Tauri keeps a Library, seeded with /songs and /other.
- **Board:** task 0020 (on a Mac, stay running with no windows).

### Task 0016 fixes: Close button, where the song is saved (#15, 2026-11-07)

- **Close** replaces "← Songs" in a song window's corner bar. It asks about unsaved changes like the red button and Cmd+W. Cmd+L still brings the song list forward.
- **Where the song lives:** the bar shows "Songbook: <name>" (or "Folder: <name>" for a song on its own), with the full path on hover. Save's message says where too: "Saved Beta.cpm in My Songs".
- **Board and changelog:** task 0016 went to `main` directly, not through a PR.

### Task 0016: each song in its own window (pushed to main, 2026-11-07)

- **Song windows:** a song opens in a window of its own, from the song list, File > Open…, New Song… or Open Recent, so several songs can be open at once to compare and copy between. Opening a song that's already open brings its window forward. New windows sit a little below and right of the one in front.
- **The song list stays put:** it's the main window; View > Show Song List (Cmd+L) brings it forward, reopening it if it was closed. File > Open Songbook… and recent songbooks go to it.
- **Menus go to the window in front:** Save, Save As…, Print… act on that song only. (A page's plain `listen` hears events sent to any window, so the pages listen for their own label.)
- **Unsaved changes:** only closing a window or quitting asks now; opening other songs doesn't leave this one. Quit asks each song window in turn, and Continue Editing in any of them stops it.
- **`src-tauri/src/windows.rs`:** the song windows, which file each holds, menu routing, and the Quit round. Capabilities cover `main` and `song-*`.
- **Song addresses** carry the folder: `editor.html?folder=…&song=…`, since a new window doesn't know the open songbook.
- **`npm run preview`:** a song opens in a browser tab, one per song.
- **Board:** the owner's Library user stories; task 0013 is now the Library; new tasks 0017 (search), 0018 (Favorites) and 0019 (a first-run welcome/tour).

### Task 0012: the Song-a-Matic's faux-wood look for the app's own pages (#13, 2026-11-07)

- **`web/css/wood.css`:** the editor's wooden strip (`.ugsAppMenuBar`), wood grain (`.overlay`), buttons (`.baseBtn`, `.orange`) and text boxes. Same colors, and the editor's own images from `vendor/song-editor/img/editor/`.
- **Song list:** wooden header with the Peralta logo, wooden buttons (Open Songbook… orange), wood-brown song titles, and the editor page's background color.
- **New Song dialog:** shaped like the editor's dialogs, with a dark frame, a wooden header strip and a wood-grain body.
- **Settings:** wood grain with wooden section labels.
- **Editor:** the "← Songs" bar is a wooden tab.
- **Board:** added task 0014.

### Task 0011: file names follow song titles (#12, 2026-11-07)

- **Settings > File names:** "Name song files" is "Title - Artist" (the default), "Title" or "Artist - Title", and New Song uses it. "Rename a song's file when its title or artist changes" is on by default.
- **Rename on save:** only when the title or artist changed since the song was opened or last saved, so untouched files keep their names. The editor follows the new name: its address, window title and Open Recent. The message says "Saved as …".
- **`SongRepository`:**
  - `availableFilename()` is `create()`'s unused-name search, moved out unchanged in its own commit.
  - `create()` takes an optional base name.
  - `updateAs()` writes under the new name with `createNew`, then removes the old file. It never overwrites, keeps the song's extension, and makes a plain update when the name wouldn't change (case-only changes included).
- **Not renamed:** songs opened on their own (File > Open…), since the app may write only that file.
- **Tests:** 4 new tests for naming and renaming.

### Task 0010: File > Print… (Cmd+P) (#11, 2026-11-07)

- **Print:** File > Print… (Cmd+P) prints the open song as shown, with the editor's print styles (`ugsEditorPlus.print.css`), which hide the toolbar and the app's "← Songs" bar.
- **Mac:** the new `print_page` command opens WKWebView's print sheet with half-inch margins and fit-to-width pages. Tauri's built-in `window.print()` sets the margins to zero, which printers clip. The Print dialog's paper choice carries over to the next print.
- **Windows:** falls back to `window.print()`, which WebView2 handles natively.
- **Song list:** Print does nothing there.

### Task 0014: unsaved changes asks Save & …, Discard Edits, or Continue Editing (#10, 2026-11-07)

- **Three choices:** leaving a song with unsaved changes (the song list, another song or songbook, New Song, Close Window, Quit) asks with three native buttons instead of two.
- **First button:** names what comes next (Save & Close, Save & Quit, Save & Go Back, Save & Open, …) and saves first, renaming the file if the title changed.
- **Discard Edits** leaves without saving.
- **Continue Editing** is the dialog's cancel button, so Esc keeps the edits.
- **Save failure:** if saving fails, the app says so and stays on the song.

### Task 0009: File > New Song… (Cmd+N); task board (#9, 2026-11-07)

- **New Song:** File > New Song… (Cmd+N) and a New Song… button on the song list. A small dialog asks for the title and artist; `SongRepository.create()` makes "Title - Artist.cpm" in the open songbook (unique name, never overwrites), and the editor opens it.
  - With no songbook open, the Open Songbook dialog comes first.
  - In the editor, unsaved changes are asked about after the song is named.
  - Return creates and Esc cancels. The dialog answers directly from those, not from its `close` event, which a page in the background can get late.
- **Task board:** `docs/BOARD.md` lists numbered tasks (Doing, Next, Later, Done). Branches are named `feature/task-NNNN_short-name`; CLAUDE.md says so. Tasks 0001–0008 are numbered by their PRs.

### Task 0008: File > Open… for a single song; Save As switches to the new file (#8, 2026-11-07)

- **Open… (Cmd+O):** opens one song of any ChordPro type on its own, as `editor.html?file=<path>`; the song list also gets an Open Song… button. The app gets access to that file only. Open Songbook… moves to Shift+Cmd+O.
- **Saving a song on its own:** a new Rust command, `save_song_file`, writes a temp file next to the song and renames it over the song. It runs in Rust because the app has no access to the song's folder, and it only writes files the app was given.
- **Open Recent:** single songs are kept as single files. At the next launch only the file is allowed again, never its folder.
- **Save As… to another folder** now switches the editor to the new file instead of saving a copy.

### Task 0007: Settings window (Cmd+,): song file types, reopening the last songbook (#7, 2026-11-07)

- **Settings window:** Settings… (Cmd+,) is in the app menu on a Mac and in File on Windows. It opens a small window (`settings.html`) whose changes save at once. It closes along with the main window.
- **Kept by Rust:** `settings.json` sits next to `recent.json`. `settings_get` and `settings_set` read and write it, and every window gets a `studio://settings` event, so the song list updates right away.
- **Song file types:** `.cpm` (on by default), `.txt` (which also lists the Songbook's `.cpm.txt`), and the other ChordPro extensions (`.cho`, `.crd`, `.chopro`, `.chord`, `.chordpro`, `.pro`). At least one must stay on.
- **Reopen the last songbook at launch:** on by default.
- **Old setting carries over:** the song list's "Also list `.cpm.txt`" checkbox is gone, and its value moves into the new `.txt` setting.
- **Empty songbooks explain themselves:** when a songbook shows no songs, the list says which other song types the folder has and points to Settings.

### Task 0006: Menus for 1.0: View, Help, Windows layout; DECISIONS.md (#6, 2026-11-07)

- **View:** Show Song List (Cmd+L) works like the editor's "← Songs" link and asks about unsaved changes. Enter Full Screen on a Mac.
- **Help:** UkeGeeks Studio Help (ukegeeks.org) and ChordPro Reference (chordpro.org). Rust opens these fixed addresses in the browser, so no opener plugin is needed. On a Mac, Window and Help are registered with macOS, which adds the window list and the Help search box.
- **Windows layout:** no app menu; About goes in Help and Quit is File > Exit. Not compiled or tried yet, since only the Mac target is installed.
- **Docs:** `docs/DECISIONS.md` records the thinking: the editor keeps its own controls, the per-OS menu layout, no Songbook menu until Phase 4, New Song yes and New Songbook not yet, Settings in Rust, song file types.

### Task 0005: File > Open Recent: recent songbooks and songs, kept across launches (#5, 2026-11-07)

- **Menu:** File > Open Recent lists the last 10 songbooks and 10 songs, most recent first; Clear Menu empties it.
- **The list:** `src-tauri/src/recent.rs` keeps it in `recent.json` in the app's config folder (`~/Library/Application Support/org.ukegeeks.studio/`). The Rust side updates the submenu whenever the list changes.
- **Folder access across launches:** at startup the list's folders are allowed again, as the Open dialog does (the folder and the files directly in it). This is used instead of the persisted-scope plugin, which keeps every folder ever picked; clearing the list also takes away the access at the next launch. `recent_add_songbook` and `recent_add_song` only accept folders the app may already read. Folders and songs that no longer exist are dropped at startup.
- **Pages:** the list page records each songbook it shows and reopens the last one at launch; the editor records each song it opens; Open Recent from the editor asks about unsaved changes first. After the editor's File > Open Songbook…, cancelling the picker keeps the open songbook listed.
- **No new crates:** `serde` and `serde_json` are already part of Tauri's build.

### Task 0004: App menu: File, Edit and Window menus; Save As; Quit asks about unsaved changes (#4, 2026-11-07)

- **The menu, built once in Rust (`src-tauri/src/lib.rs`):**
  - UkeGeeks Studio: About, Services, Hide, Hide Others, Show All, Quit (Cmd+Q).
  - File: Open Songbook… (Cmd+O), Save (Cmd+S), Save As… (Shift+Cmd+S), Close Window (Cmd+W).
  - Edit: Undo, Redo, Cut, Copy, Paste, Select All. Without these, Cmd+Z/X/C/V/A stop working in the text boxes.
  - Window: Minimize, Zoom.
- **Menu events:** Open Songbook…, Save, Save As… and Quit send a `studio://menu` event to the page; `web/js/menu.js` passes it to the page's handler. Save clicks the editor's own Save button, so its message and its "problem saving" alert still show.
- **Save As…:** uses the native save dialog (`dialog:allow-save`). In the songbook folder it writes the file (temp file + rename) and switches to it. The native dialog asks before replacing a file; nothing else overwrites.
- **Quitting:** in Tauri 2.12.5 the built-in Quit item and Dock > Quit end the app without sending an event. So Quit is a custom item: the page asks about unsaved changes, then calls the new `quit` command. Dock > Quit is caught by adding `applicationShouldTerminate:` to Tauri's app delegate (`objc2`, macOS only; already part of Tauri's build).

### Task 0003: `.cpm` songs; unsaved changes (#3, 2026-11-07)

- **`.cpm` is the song extension;** a setting also lists the Songbook's `.cpm.txt` files.
- **Unsaved changes:** the window title says "Edited", and going back to the song list or closing the window asks first.
- Cleaned up the project's folders.

### Task 0002: Phase 2: Mac prototype: open a songbook folder, list, edit and save songs (#2, 2026-11-07)

A Tauri 2 Mac app, run with `npm run dev`. Open Songbook… picks a folder of ChordPro songs, and the songs are listed sorted like the Songbook. One opens in the Song-a-Matic editor (`@ukegeeks/song-editor`), and Save writes the file. Theme fonts are bundled so it works offline. The Songbook's `songs.js` comes in unchanged first (e7a6206), then is switched to Tauri's file access (3bbdbb4). Tested with `npm test`, in a browser against a stand-in for Tauri, and in the app on the Songbook's `cpm/` folder.

### Task 0001: Project notes (#1, 2026-11-07)

README, CLAUDE.md, the roadmap and handoff notes, and the logo.
