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

## Phase 2: Mac prototype (next)

A **Tauri 2** app. Tauri wraps web code in a small native app for Mac and Windows, and the same project can later build for iPad; Electron can't do iPad.

- Open or create a "songbook" folder. Each song is a plain-text ChordPro file (the same format as the Songbook's `cpm/` folder), so nothing is locked in.
- List the songs; open one in the editor; Save writes the file.
- **No server.** The Songbook's Node server is replaced by direct file access through Tauri. Reuse its song parsing (`server/lib/songs.js` in the Songbook: title, artist, sorting).

Done means: it runs on the owner's Mac from a dev build, opens `~/Code/UkeGeeks/cpm/`, and edits and saves a song.

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
