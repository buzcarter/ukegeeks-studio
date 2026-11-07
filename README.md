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

| Module                                                                        | Package                                                                                                    | What it does                                                                                                                 |
|-------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| **UkeGeeks Studio**                                                           | [this repo](https://github.com/buzcarter/ukegeeks-studio)                                                  | The desktop app                                                                                                              |
| [Song Editor](https://github.com/buzcarter/song-editor)                       | [npmjs `@ukegeeks/song-editor`](https://www.npmjs.com/package/@ukegeeks/song-editor)                       | The Song-a-Matic editor: menus, dialogs, Chord Builder, fullscreen editing. [Demo](https://buzcarter.github.io/song-editor/) |
| [Song Formatter](https://github.com/buzcarter/song-formatter)                 | [npmjs `@ukegeeks/song-formatter`](https://www.npmjs.com/package/@ukegeeks/song-formatter)                 | Reads ChordPro, draws the songsheet and SVG chord diagrams [Demo](https://buzcarter.github.io/song-formatter/)               |
| [ACE ChordPro Extension](https://github.com/buzcarter/ace-chordpro-extension) | [npmjs `@ukegeeks/ace-chordpro-extension`](https://www.npmjs.com/package/@ukegeeks/ace-chordpro-extension) | Highlighting and autocomplete for the fullscreen editor[Demo](https://buzcarter.github.io/ace-chordpro-extension/)           |
| [UkeGeeks Songbook](https://github.com/buzcarter/UkeGeeks)                    | [GitHub](https://github.com/buzcarter/ukegeeks)                                                            | The self-hosted web songbook[Demo](https://buzcarter.github.io/UkeGeeks/)                                                    |
| [ukegeeks.org](https://ukegeeks.org)                                          |                                                                                                            | The home site with tutorials, examples, & videos                                                                             |

## License

GPL-3.0. Copyright 2026 Buz Carter.
