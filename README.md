# UkeGeeks Studio

A desktop app for making ukulele songbooks. Collect your songs, tidy them up in the Song-a-Matic editor, and (soon) export one songbook PDF that your club can print or read on a tablet.

**Status:** just starting. Nothing to install yet. See [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

## Who it's for

Someone running a ukulele club. They have songsheets (paper, PDFs, text pasted from websites) and want **one tidy songbook** their members can print or read on a tablet. They aren't looking for a guitar tab editor. Most song editors are made for guitar and are too complicated; UkeGeeks Studio is simple and uke-first.

## How it works

- A **songbook is a folder**. Each song is a plain-text [ChordPro](https://www.chordpro.org/) file (`*.cpm.txt`), so nothing is locked in: the same files work in the self-hosted [UkeGeeks Songbook](https://github.com/buzcarter/UkeGeeks).
- Songs open in the **Song-a-Matic editor**, with ukulele chord diagrams, transpose, GCEA/DGBE/ADF#B tunings, color themes and a Chord Builder.
- Save writes the file. There's no server and no account.

Built with [Tauri 2](https://tauri.app/) for macOS and Windows; the same project can later build for iPad.

## Part of the UkeGeeks family

<img src="docs/images/ukegeeks-mascot-192.png" alt="The UkeGeeks mascot, a dinosaur playing the ukulele" width="96" height="96" align="right">


| Piece | What it does |
|---|---|
| **UkeGeeks Studio** (this repo) | The desktop app |
| [Song Editor](https://github.com/buzcarter/song-editor) (`@ukegeeks/song-editor`) | The Song-a-Matic editor: menus, dialogs, Chord Builder, fullscreen editing. [Demo](https://buzcarter.github.io/song-editor/) |
| [Song Formatter](https://github.com/buzcarter/song-formatter) (`@ukegeeks/song-formatter`) | Reads ChordPro, draws the songsheet and SVG chord diagrams |
| [ACE ChordPro Extension](https://github.com/buzcarter/ace-chordpro-extension) (`@ukegeeks/ace-chordpro-extension`) | Highlighting and autocomplete for the fullscreen editor |
| [UkeGeeks Songbook](https://github.com/buzcarter/UkeGeeks) | The self-hosted web songbook |
| [ukegeeks.org](https://ukegeeks.org) | The home site |

## License

GPL-3.0. Copyright 2026 Buz Carter.
