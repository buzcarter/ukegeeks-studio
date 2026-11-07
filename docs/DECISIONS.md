# Decisions: what we were thinking

Why the app is the way it is, so later work doesn't undo it by accident. Newest first. The plan itself is in [ROADMAP.md](ROADMAP.md).

## Menus, settings and new songs (2026-11-06)

From a talk with the owner after the app menu (PR #4) and Open Recent (PR #5) landed.

### The editor keeps its own controls

For 1.0 the Song-a-Matic editor stays as it is, with its own menus (themes, transpose, layout, the Chord Builder), just like the web app. The OS menu doesn't take them over.

**Why:** keep 1.0 simple. And the OS menu only exists on Mac and Windows: Tauri's menu API is desktop-only, Android has no menu bar, and Tauri can't fill the iPad's (iPadOS 26) menu bar yet. So everything must be reachable from the page anyway; the OS menu is a second way in, mostly for keyboard shortcuts.

**How:** each menu item is an event the page handles (`web/js/menu.js`, `onMenu(id, handler)`). An iPad toolbar button can call the same handler later.

### What's in the menus for 1.0

On a Mac:

- **UkeGeeks Studio:** About, Settings… (Cmd+,), Services, Hide, Hide Others, Show All, Quit. Apple says "Settings" since macOS 13, not "Preferences".
- **File:** New Song (Cmd+N), Open Songbook… (Cmd+O), Open Recent, Close Window, Save, Save As…, Print… (Cmd+P, once printing is done).
- **Edit:** the standard items. Without them Cmd+C/V/Z stop working in text boxes.
- **View:** Show Song List (Cmd+L), Enter Full Screen.
- **Window:** Minimize, Zoom.
- **Help:** UkeGeeks Studio Help (ukegeeks.org), ChordPro Reference (chordpro.org). macOS adds a search box to Help on its own.

On Windows the menu bar is inside the window and there's no app menu: About moves to Help, Settings to File, and Quit becomes File > Exit.

**No Songbook menu yet.** For 1.0 it would hold two items (Show Song List, Show in Finder). It earns its place in Phase 4, with Export PDF… and songbook settings.

### New Song yes, New Songbook not yet

- **File > New Song** asks for a title and artist and creates "Title - Artist.cpm" in the open songbook. The Songbook's `SongRepository.create()` already does this safely (no overwrites, unique names).
- **No "New Songbook…" item for 1.0.** A songbook is just a folder, and the Mac folder picker has a New Folder button: Open Songbook…, New Folder, Open. A real New Songbook item would need the app to get access to a folder it created itself, which is more plumbing. Revisit if people get stuck.

### Settings live in their own window, kept by Rust

- **A separate small window** (`settings.html`), opened by Settings… (Cmd+,), rather than a dialog inside the page: the pages reload on every song change, and a Mac user expects a settings window.
- **Kept in `settings.json`**, in the app's config folder next to `recent.json`, read and written through Rust commands. Every window, and later the iPad build, sees the same values. (Today "Also list `.cpm.txt` songs" is in the page's browser storage; it moves.)
- **First settings:**
  - **Song file types:** which extensions the song list shows. New songs are always `.cpm`.
  - **Reopen the last songbook at launch** (on by default).
  - Later: how new files are named, from the song's title and artist.

### Song file extensions

`.cpm` is the UkeGeeks extension (most ukulele song sites use it). `.cpm.txt` is only a `.txt` in disguise: the Songbook uses it because Apache serves unknown types badly. So the setting is about extensions the list shows, not about `.cpm.txt` specially:

- **`.cpm`**: on by default; new songs use it.
- **`.txt`**: off by default. It covers the Songbook's `*.cpm.txt` files and plain-text songs.
- **Other ChordPro extensions** (chordpro.org's list): `.cho` (ChordPro's recommended default), `.crd`, `.chopro`, `.chord`, `.chordpro`, `.pro`. Off by default; one checkbox for the group is probably enough.

A folder may hold `.txt` files that aren't songs; they show up with a title from the filename. Good enough.

### Open Recent without the persisted-scope plugin (PR #5)

Tauri's persisted-scope plugin keeps every folder ever picked, forever. The app instead keeps the recent list in `recent.json` and allows just those folders again at startup (`src-tauri/src/recent.rs`), so clearing the list also ends the access. Only folders the app can already read get into the list.

### Quit goes through the page (PR #4)

In Tauri 2.12 the built-in Quit item and Quit in the Dock end the app at once (NSApp `terminate:`), with no event to catch. So Quit is the app's own menu item, which asks the page about unsaved changes first; Quit in the Dock is caught by adding `applicationShouldTerminate:` to Tauri's app delegate (`src-tauri/src/lib.rs`).
