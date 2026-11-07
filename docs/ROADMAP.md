# Roadmap: UkeGeeks Studio

Carried over on 2026-11-07 from the Song Editor's [ROADMAP.md](https://github.com/buzcarter/song-editor/blob/main/ROADMAP.md), where Phase 1 (pulling the editor out of the Songbook into `@ukegeeks/song-editor`) is done. The phases keep their numbers.

## How the pieces stack

```
UkeGeeks Studio (this repo) · Songbook (self-hosted) · ukegeeks.org
        └── Song Editor: menus, dialogs, Chord Builder, fullscreen editing
              ├── Song Formatter: reads ChordPro, draws the songsheet and SVG chord diagrams
              └── ACE ChordPro Extension: highlighting and autocomplete, fullscreen only
```

Each layer only knows the one below it. The editor doesn't bundle Song Formatter or Ace: the host (this app) puts them on the page. The host also decides where songs live and what "save" means.

## Phase 2: Mac prototype (done)

A **Tauri 2** app. Tauri wraps web code in a small native app for Mac and Windows, and the same project can later build for iPad; Electron can't do iPad.

- Open or create a "songbook" folder. Each song is a plain-text ChordPro file (the same format as the Songbook's `cpm/` folder), so nothing is locked in.
- List the songs; open one in the editor; Save writes the file.
- **No server.** The Songbook's Node server is replaced by direct file access through Tauri. Reuse its song parsing (`server/lib/songs.js` in the Songbook: title, artist, sorting).

Done means: it runs on the owner's Mac from a dev build, opens `~/Code/UkeGeeks/cpm/`, and edits and saves a song. Done 2026-11-06 (PR #2).

## Phase 2.5: a real app (next)

The owner's list from 2026-11-06, after the prototype worked. Roughly in order; items move to "done" as they land. The reasons behind these choices are in [DECISIONS.md](DECISIONS.md).

- **`.cpm` is the file extension.** Songs are `*.cpm` files. `.cpm.txt` exists only because Apache serves unknown types badly and most people can't change MIME types; a setting also lists `*.cpm.txt` files. This applies to every UkeGeeks module and app, not just Studio (the Songbook still uses `.cpm.txt`).
- **The 1.0 menus.** (Done.) Add Settings… (Cmd+,), View (Show Song List, Enter Full Screen) and Help, plus the Windows layout (About in Help, Exit in File). The editor keeps its own controls; no Songbook menu until Phase 4.
- **Unsaved changes.** (Done.) An `isDirty` flag; warn before leaving a song or closing the window (and quitting) with unsaved changes.
- **Save As.** (Done, with the app menu.)
- **File names follow song titles.** (Done: Settings > File names.) A naming convention, as a setting: "Title - Artist" (as the Songbook's New Song does) or similar. Renaming a song's file when its title changes, with care for collisions.
- **Songbooks are folders**, and the app can point at more than one. A songbook export is far off (Phase 4): copying files into a folder is easy enough for now.
- **Recent songbooks and songs (MRU lists)**, which also means remembering folders across launches. (Done: File > Open Recent. Instead of Tauri's persisted-scope plugin, which would keep every folder ever picked, the app allows the recent list's folders again at startup; see `src-tauri/src/recent.rs`.)
- **Settings** for the above, kept by the app. (Done: file types and reopening the last songbook; file naming comes with that item.) A Settings window (Cmd+,) and `settings.json`, read and written through Rust. First settings: song file types to list (`.cpm` on; `.txt`, which covers `.cpm.txt`, off; the other ChordPro extensions `.cho`, `.crd`, `.chopro`, `.chord`, `.chordpro`, `.pro` off), and reopening the last songbook at launch.
- **File > Open…** (Cmd+O) for one song on its own. (Done; Open Songbook… is now Shift+Cmd+O.) Double-clicking a song in Finder comes with the bundle (Phase 5).
- **File > New Song** (Cmd+N). (Done.) title and artist, then "Title - Artist.cpm" in the open songbook (`SongRepository.create()`). No New Songbook item for 1.0: the folder picker's New Folder button does it.
- **Keep the faux-wood look** of the Song-a-Matic headers and dialogs in the app's own chrome and dialogs. Hokey, but it's UkeGeeks.
- **Print.** (Done: File > Print….) One song, nicely; the editor already has print styles and paper sizes.

Later, maybe release 1.2: **Ace as the default editor** instead of the plain Edit Song box, which means working out how the Chord Builder fits with it.

## Phase 3: add a song from a songsheet

Paste a songsheet; the editor's plain-text-to-ChordPro converter (`ugsEditorPlus.reformat` and `autoReformat`, in the Song Editor package) turns it into ChordPro, and the editor opens it.

## Phase 4: make the songbook

The feature uke clubs want: pick songs, order them, and export **one PDF** with a cover, table of contents, page numbers and consistent formatting. Members get a PDF they can print or open on an iPad today, before any iPad app exists.

## Phase 5: ship for Mac and Windows

App icon (the Maestro Saurus favicon set is in `~/Sites/ukegeeks.org/resources/favicon/package/claude/`), installers, code signing, remembering the last songbook, and an About page linking to ukegeeks.org.

## Phase 6: iPad

The same Tauri project built for iPadOS. Needs full Xcode; today the machine has only the Command Line Tools.

## Decided

- **App name:** UkeGeeks Studio (2026-11-07). "UkeGeeks Songbook" stays the name of the self-hosted web app.
- **Repo:** its own, buzcarter/ukegeeks-studio, depending on the npm packages.
- **Editor package:** `@ukegeeks/song-editor` (published 1.0.0-beta.1 and 1.0.1-beta.1).
- **Bundle identifier:** `org.ukegeeks.studio`.
- **Theme fonts:** bundled in `web/fonts/` (OFL and Apache 2.0), not loaded from Google Fonts, so the app works offline.

## Still open

- Windows: when to start building and testing there.
