# Handoff: starting Phase 2

Written 2026-11-07 at the end of the session that pulled the editor out of the Songbook. Read [CLAUDE.md](../CLAUDE.md) and [ROADMAP.md](ROADMAP.md) first.

## Where things stand

- **Song Editor** (`@ukegeeks/song-editor`): Phase 1 is done. On npm, `beta` is 1.0.1-beta.1 (a README-only change) and `latest` is 1.0.0-beta.1; the code is the same. Demo: https://buzcarter.github.io/song-editor/ (`npm run demo` in its repo serves it locally on port 8098).
- **UkeGeeks Songbook** uses the package since PR #37, with no visible change. Its default branch is now `main` (PR #38).
- **Song Formatter** is 1.0.0-beta.1 (`latest` and `beta`). **ACE ChordPro Extension** is 1.0.0.
- **This repo** has only README, LICENSE, CLAUDE.md and these docs. No app code yet.

## Phase 2 goal

A Tauri 2 Mac app, run from a dev build: open a folder of ChordPro songs (`~/Code/UkeGeeks/cpm/` has 16 samples), list them, open one in the editor, and Save writes the file. Details in [ROADMAP.md](ROADMAP.md).

## What the editor needs from its host page

All from the Song Editor's README; read it in `node_modules/@ukegeeks/song-editor/README.md` once installed.

- **Load order:** Song Formatter's `song-formatter.bundle.js`, then `ugsEditorPlus.min.js`. Styles: `ukeGeeks.music.css` (from Song Formatter), then `ugsEditorPlus.min.css`, which **must** have `title="ugsEditorCss"` (the editor edits its rules to resize fonts and diagrams), plus `ugsEditorPlus.print.css` with `media="print"`.
- **Files:** the package's `dist/` is laid out like a web page: `dist/js/`, `dist/css/`, `dist/img/editor/`. Copy those folders side by side into the app's web folder: the CSS and `mount()` find the images at `../img/editor/`.
- **Mounting:** `ugsEditorPlus.songAmatic.mount(element, { song, save, aceUrl, ...options })` returns `{ getSong() }`. `save(text)` returns a message, or a promise of one, which the editor shows next to Save; a rejection shows a "problem saving" alert. Without `save` there's no Save button.
- **One editor per page:** it finds its parts by element id. Opening another song means a fresh page (for example, a song list page and an editor page, navigating between them), not a second `mount()`.
- **Fullscreen** lazy-loads `ace-chordpro.min.js` from `aceUrl` (default: `ace/` next to `ugsEditorPlus.min.js`), from `@ukegeeks/ace-chordpro-extension`'s `dist/`.
- The color themes use Google Fonts. An offline desktop app should either bundle those fonts or accept the fallback fonts; decide with the owner.

The Song Editor repo's demo is a small, working host page to copy from: `demo/index.html` and `demo/demo.js`, with `scripts/site.js` mapping the package files into place.

## Reusing the Songbook's song handling

`~/Code/UkeGeeks/server/lib/songs.js` (Node, 2 spaces) has what the song list needs: `parseSong(text)` (title, subtitle, artist, album and meta from ChordPro), `fixLeadingArticle` ("The Rose" sorts as "Rose, The"), `filenameToTitle`, and `scrubForFilename` (safe, Unicode-friendly filenames for new songs). `SongRepository` shows how the Songbook lists, sorts and saves songs, and why song ids are never joined onto paths directly. Copy the pure functions unchanged first ("move, don't rewrite"); the file access becomes Tauri's.

## Tauri notes

- Versions on npm on 2026-11-07: `@tauri-apps/cli` and `@tauri-apps/api` 2.12.4, `@tauri-apps/plugin-fs` 2.7.1, `@tauri-apps/plugin-dialog` 2.8.4. The Tauri CLI isn't installed globally; use it from devDependencies (`npx tauri`).
- File access goes through Tauri 2 **capabilities** and the fs plugin's scopes. The user picks the songbook folder with the dialog plugin; allow reading and writing inside it.
- Tauri applies a Content Security Policy. The editor injects Ace's script on demand and sets inline styles; check the console when Fullscreen opens.
- The app's web code can be plain static files (no bundler needed), with a small Node script that copies the three packages' files in, like the Songbook's `scripts/build.js` does with its `VENDORED` list.
- The first `cargo` build downloads and compiles a lot. Mind the disk space note in CLAUDE.md.

## Suggested first steps

1. Agree with the owner on a short plan: project layout, how the web files get copied in, the folder-picking and saving flow, and the bundle identifier (suggestion: `org.ukegeeks.studio`).
2. On a `feature/` branch: scaffold the Tauri 2 app and get an empty window running (`npx tauri dev`). Commit.
3. Host the editor with one bundled sample song. Check: diagrams, transpose, tunings, Chord Builder, Fullscreen. Commit.
4. Pick a folder, list its songs (sorted like the Songbook), open one, Save writes the file. Commit.
5. Write down how to run it in the README.

## Things that went wrong last time

- The owner's `!` commands ran in the session folder instead of the repo they were meant for: a push, a tag and an `npm publish` went to the wrong repo. The Songbook's `"private": true` stopped the publish. Hence the `cd ~/Code/<repo> &&` rule.
- A commit landed on a local `main` because the owner had merged and switched branches mid-session. Hence "check the branch again before every commit".
- `npm publish` with npm 11 needs `--tag` for prerelease versions, and asks for a browser sign-in. A new package name also gets an untagged `0.0.0-stage` placeholder version from npm; it's harmless.
