# Backlog

One backlog for every UkeGeeks repo (Studio, the song editor, Song Formatter, the ACE extension, the Songbook, the website). Each item has one number, `UGS-NNNN`, that never changes when items are reordered, and says which repo(s) it touches. Work goes one item at a time, in order, unless a partner has taken an item (see "Agent collaboration" in [CLAUDE.md](../CLAUDE.md)).

An item's branch is `feature/ugs-NNNN_short-name` (or `bugfix/ugs-NNNN_…`), in whichever repo the work lands. Its PR updates this file (Doing → Done, with the PR number). The why behind the choices is in [DECISIONS.md](DECISIONS.md); the bigger phases in [ROADMAP.md](ROADMAP.md).

The next free number is **UGS-0036**.

## Doing

Nothing is in progress.

## Next (in order; rearrange freely)

The editor is Buz's again (2026-11-11), so its items are ordered here with Studio's, by what unblocks the app.

| ID | Repos | What | Depends on |
|---|---|---|---|
| UGS-0035 | songbook | Move the Songbook to `@ukegeeks/song-editor` 2.0.0-beta.4: its pages copy the editor's markup, which changed (buttons, no `hgroup`, `ugsEditor-` class names), so take it from `editorHtml()` again; check its own CSS and scripts for the old link markup and class names | |
| UGS-0019 | studio | A first-run welcome or short tour, so a new player gets the most out of the app | |
| UGS-0027 | editor | Data-driven menus: build the toolbar and its drop-down menus from a data model (items, labels, icons, actions) instead of fixed markup | |

## Later

- Editor bug (found 2026-11-11): Transpose works from the song as of the last Update click, so text typed since then, and not yet Updated, is dropped when you transpose. It should use the text in the box.
- Editor: the rest of its TypeScript roadmap, in order: `noUnusedLocals`, ES modules (the sources are still plain scripts joined in a fixed order), dropping LESS.
- **UGS-0028** (studio, editor): Studio adds and changes editor menus through an API (needs UGS-0027).
- Editor: replace the pseudo-select pickers (`<li><a href="#12">`, about 44 anchors) with real controls (`<select>`, radio groups or a keyboard-friendly listbox). Add `aria-expanded` to the toolbar once menu state is tracked in one place (UGS-0027). Needs a look in a browser: the look changes.
- Duplicate a songbook (owner's "Duplicate(?)", 2026-11-07): copy its songs to a new folder the player picks. Not yet: the app may only write where it's pointed, so it needs its own "where does the copy go" step; confirm what's wanted first.
- Set lists (after Favorites, UGS-0018): named lists of songs from any songbook, in an order of the player's own ("Tuesday jam", "Open mic"), in the sidebar under Favorites. `favorites.json` already keeps lists; this adds making, renaming and reordering them.
- Ace as the default editor instead of the Edit Song box (maybe 1.2); how the Chord Builder fits with it.
- Phase 3: add a song from a pasted songsheet.
- Phase 4: make the songbook (one PDF), and a Songbook menu with it.
- Phase 5: ship for Mac and Windows: app icon, installers, signing, double-clicking a song in Finder opens it.
- Phase 6: iPad, with toolbar buttons for what the menus do.

## Done

| ID | Repos | What | PR |
|---|---|---|---|
| UGS-0033 | editor, studio | Keep the editor inside its own box: its 75 generic class names (`.overlay`, `.isHidden`, `.active`…) start with `ugsEditor-`, and its DOM lookups stay inside the mounted element. Published as `@ukegeeks/song-editor` 2.0.0-beta.4 (the same code as beta.2; there is no beta.3). Studio uses none of the old names, so its half was a check: the pages, the menus, the Chord Builder, Fullscreen and Save work on it, and only three CSS comments needed the new names | song-editor#26 (and #27, the version bump), #NN |
| UGS-0034 | editor, studio | A host API on `mount()`: `editor.save()` and an `onChange` option, published as `@ukegeeks/song-editor` 2.0.0-beta.1 (with UGS-0025's breaking markup). Studio's editor page uses it and no longer clicks `#saveBtn`, reads Ace or polls for "Edited" | song-editor#25, #23, and the version bump's PR |
| UGS-0032 | studio | Code review, reorganisation and fixes: shared modules in `web/js/lib/`, `lib.rs` split up, one safe store for the JSON files, ESLint and CI, a stale song list after a rename, names holding HTML entities. What's left is in [HANDOFF.md](HANDOFF.md), "From the code review" | #22 |
| UGS-0030 | editor | `noUncheckedIndexedAccess` on, and the 107 errors it showed fixed | song-editor#24 |
| UGS-0024 | studio | Songbook feedback: top-bar actions collapsed into a + menu, the New Song filename shown and customizable, the songbook list refreshes when songs are created | #21 |
| UGS-0031 | studio | Library sidebar feedback (2026-11-09 user test): All Songs, "!" for unreadable folders, Open Folder / Change Folder… / Bundle all as PDF (disabled) in the right-click menu, no +/− buttons, confirm before removing | #20 |
| UGS-0029 | editor | The same agent-collaboration and never-push rules in the editor's `CLAUDE.md`, so a partner's Claude sees them | song-editor#23 |
| UGS-0026 | studio | This shared backlog and the agent-collaboration rules | #20 |
| UGS-0025 | editor | Editor cleanup: no `ugs`/`ugsEditorPlus` prefixes, the page HTML in `src/templates/editor.html`, action controls and toolbar as `<button>`s, no `hgroup`. Breaking, so it ships as 2.0.0 (version and changelog not yet bumped) | song-editor#21 |
| UGS-0018 | studio | Favorites: a ☆ on every song (list, search results, song windows); Favorites at the top of the sidebar lists starred songs from every songbook. Kept in `favorites.json` as lists, ready for set lists | #20 |
| UGS-0023 | studio | A new handoff after the Library (docs/HANDOFF.md) | #19 |
| UGS-0017 | studio | Search the Library by title, artist or lyrics: a search box above the song list (Cmd+F), across every songbook | pushed to `main` |
| UGS-0022 | studio | A songbook's right-click menu: Open, New Song… (in that songbook), Rename…, Remove from Library | pushed to `main` |
| UGS-0021 | studio | Songbook names: asked when a folder is added (folders are often just "songs" or "cpm"), Rename… in the sidebar | #18 |
| UGS-0020 | studio | On a Mac, the app stays running when its last window closes; clicking the Dock icon brings back the Library (elsewhere it still quits) | #17 |
| UGS-0013 | studio | The Library: songbook folders in a sidebar beside the song list (`library.json`); Add Songbook to Library… replaces Open Songbook…; Open Recent lists songs only. Printing a whole songbook stays in Phase 4 | #16 |
| UGS-0016 | studio | Each song in its own window: several songs open at once, to compare and copy between; a song from outside the Library opens the same way | pushed to `main`; fixes #15 |
| UGS-0015 | studio | CHANGELOG.md, a new handoff (docs/HANDOFF.md), `npm run preview` (the pages in a browser with a fake Tauri) | #14 |
| UGS-0014 | studio | Unsaved changes asks Save & … (Save & Close, Save & Quit, Save & Open…), Discard Edits, or Continue Editing (Esc); a failed save stays on the song | #10 |
| UGS-0012 | studio | The Song-a-Matic's faux-wood look for the app's own pages and dialogs (`web/css/wood.css`) | #13 |
| UGS-0011 | studio | File names follow song titles: a naming setting, and saving a song whose title or artist changed renames its file (never over another) | #12 |
| UGS-0010 | studio | File > Print… (Cmd+P): one song, with the editor's print styles; half-inch margins on a Mac | #11 |
| UGS-0009 | studio | File > New Song… (Cmd+N) and a New Song… button on the song list: title and artist, then "Title - Artist.cpm" in the open songbook | #9 |
| UGS-0008 | studio | File > Open… for one song on its own; Save As switches to the new file | #8 |
| UGS-0007 | studio | Settings window (Cmd+,): song file types, reopening the last songbook | #7 |
| UGS-0006 | studio | Menus for 1.0: View, Help, Windows layout; DECISIONS.md | #6 |
| UGS-0005 | studio | File > Open Recent, kept across launches | #5 |
| UGS-0004 | studio | App menu; Save As; Quit asks about unsaved changes | #4 |
| UGS-0003 | studio | `.cpm` songs; unsaved changes ("Edited", ask before closing) | #3 |
| UGS-0002 | studio | Mac prototype: open a folder, list, edit, save | #2 |
| UGS-0001 | studio | Project notes: README, CLAUDE.md, roadmap, handoff | #1 |

UGS-0001 to UGS-0008 were numbered afterwards, by their PRs. Everything above was numbered per repo before this file existed; those numbers are now the UGS numbers.
