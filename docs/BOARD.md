# Board

A pseudo-sprint board: one task at a time, in order. Each task keeps its number for good, even when the order changes; new tasks take the next number. Its branch is `feature/task-NNNN_short-name` (or `bugfix/…`), and its PR moves it to Done.

The why behind the choices is in [DECISIONS.md](DECISIONS.md); the bigger phases in [ROADMAP.md](ROADMAP.md).

## Doing

| Task | What | Branch |
|---|---|---|
| | (nothing: the next task starts here) | |

## Next (in order; rearrange freely)

| Task | What |
|---|---|
| 0019 | A first-run welcome or short tour, so a new player gets the most out of the app |

## Later

- Duplicate a songbook (owner's "Duplicate(?)", 2026-11-07): copy its songs to a new folder the player picks. Not yet: the app may only write where it's pointed, so it needs its own "where does the copy go" step; confirm what's wanted first.
- Set lists (after Favorites, task 0018): named lists of songs from any songbook, in an order of the player's own ("Tuesday jam", "Open mic"), in the sidebar under Favorites. `favorites.json` already keeps lists; this adds making, renaming and reordering them.
- Ace as the default editor instead of the Edit Song box (maybe 1.2); how the Chord Builder fits with it.
- Phase 3: add a song from a pasted songsheet.
- Phase 4: make the songbook (one PDF), and a Songbook menu with it.
- Phase 5: ship for Mac and Windows: app icon, installers, signing, double-clicking a song in Finder opens it.
- Phase 6: iPad, with toolbar buttons for what the menus do.

## Done

| Task | What | PR |
|---|---|---|
| 0018 | Favorites: a ☆ on every song (list, search results, song windows); Favorites at the top of the sidebar lists starred songs from every songbook. Kept in `favorites.json` as lists, ready for set lists | #20 |
| 0023 | A new handoff after the Library (docs/HANDOFF.md) | #19 |
| 0017 | Search the Library by title, artist or lyrics: a search box above the song list (Cmd+F), across every songbook | pushed to `main` |
| 0022 | A songbook's right-click menu: Open, New Song… (in that songbook), Rename…, Remove from Library | pushed to `main` |
| 0021 | Songbook names: asked when a folder is added (folders are often just "songs" or "cpm"), Rename… in the sidebar | #18 |
| 0020 | On a Mac, the app stays running when its last window closes; clicking the Dock icon brings back the Library (elsewhere it still quits) | #17 |
| 0013 | The Library: songbook folders in a sidebar beside the song list (`library.json`); Add Songbook to Library… replaces Open Songbook…; Open Recent lists songs only. Printing a whole songbook stays in Phase 4 | #16 |
| 0016 | Each song in its own window: several songs open at once, to compare and copy between; a song from outside the Library opens the same way | pushed to `main`; fixes #15 |
| 0015 | CHANGELOG.md, a new handoff (docs/HANDOFF.md), `npm run preview` (the pages in a browser with a fake Tauri) | #14 |
| 0014 | Unsaved changes asks Save & … (Save & Close, Save & Quit, Save & Open…), Discard Edits, or Continue Editing (Esc); a failed save stays on the song | #10 |
| 0012 | The Song-a-Matic's faux-wood look for the app's own pages and dialogs (`web/css/wood.css`) | #13 |
| 0011 | File names follow song titles: a naming setting, and saving a song whose title or artist changed renames its file (never over another) | #12 |
| 0010 | File > Print… (Cmd+P): one song, with the editor's print styles; half-inch margins on a Mac | #11 |
| 0009 | File > New Song… (Cmd+N) and a New Song… button on the song list: title and artist, then "Title - Artist.cpm" in the open songbook | #9 |
| 0008 | File > Open… for one song on its own; Save As switches to the new file | #8 |
| 0007 | Settings window (Cmd+,): song file types, reopening the last songbook | #7 |
| 0006 | Menus for 1.0: View, Help, Windows layout; DECISIONS.md | #6 |
| 0005 | File > Open Recent, kept across launches | #5 |
| 0004 | App menu; Save As; Quit asks about unsaved changes | #4 |
| 0003 | `.cpm` songs; unsaved changes ("Edited", ask before closing) | #3 |
| 0002 | Mac prototype: open a folder, list, edit, save | #2 |
| 0001 | Project notes: README, CLAUDE.md, roadmap, handoff | #1 |

Tasks 0001–0008 were numbered afterwards, by their PRs.
