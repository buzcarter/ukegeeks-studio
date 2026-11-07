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
| 0012 | The faux-wood look of the Song-a-Matic headers and dialogs in the app's own pages and dialogs (song list, Settings, New Song) |
| 0013 | More than one songbook at once (the app points at several folders); today it's one at a time plus Open Recent |

## Later

- Ace as the default editor instead of the Edit Song box (maybe 1.2); how the Chord Builder fits with it.
- Phase 3: add a song from a pasted songsheet.
- Phase 4: make the songbook (one PDF), and a Songbook menu with it.
- Phase 5: ship for Mac and Windows: app icon, installers, signing, double-clicking a song in Finder opens it.
- Phase 6: iPad, with toolbar buttons for what the menus do.

## Done

| Task | What | PR |
|---|---|---|
| 0011 | File names follow song titles: a naming setting, and saving a song whose title or artist changed renames its file (never over another) | #11 |
| 0010 | File > Print… (Cmd+P): one song, with the editor's print styles; half-inch margins on a Mac | #10 |
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
