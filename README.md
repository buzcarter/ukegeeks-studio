# UkeGeeks Studio

A desktop app for making ukulele songbooks. Collect your songs, tidy them up in the Song-a-Matic editor, and (soon) export one songbook PDF that your club can print or read on a tablet.

**Status:** a Mac prototype you run from source: it opens a songbook folder, lists the songs, and edits and saves them. Nothing to install yet. See [docs/ROADMAP.md](docs/ROADMAP.md) for the plan.

## Who it's for

Someone running a ukulele club. They have songsheets (paper, PDFs, text pasted from websites) and want **one tidy songbook** their members can print or read on a tablet. They aren't looking for a guitar tab editor. Most song editors are made for guitar and are too complicated; UkeGeeks Studio is simple and uke-first.

## How it works

- A **songbook is a folder**. Each song is a plain-text [ChordPro](https://www.chordpro.org/) file (`*.cpm.txt`), so nothing is locked in: the same files work in the self-hosted [UkeGeeks Songbook](https://github.com/buzcarter/UkeGeeks).
- Songs open in the **Song-a-Matic editor**, with ukulele chord diagrams, transpose, GCEA/DGBE/ADF#B tunings, color themes and a Chord Builder.
- Save writes the file. There's no server and no account.

Built with [Tauri 2](https://tauri.app/) for macOS and Windows; the same project can later build for iPad.

## Run it from source

You need [Node.js](https://nodejs.org/) 24 or later and [Rust](https://www.rust-lang.org/tools/install). On a Mac, the Xcode Command Line Tools are enough (`xcode-select --install`).

```
npm install
npm run dev
```

The first `npm run dev` downloads and compiles Tauri, which takes a few minutes and about 1.5 GB of disk in `src-tauri/target/`. Later runs start in seconds. `cargo clean` in `src-tauri/` gives the space back.

In the window, click **Open Songbook…** and pick a folder of `*.cpm` files (for the Songbook's `cpm/` folder, turn on `.txt` files in Settings, Cmd+,). Click a song to open it in the editor; **Save** writes the file. **File > Open Recent** lists the last 10 songbooks and songs, and the app reopens the last songbook when it starts (a setting).

### Menu shortcuts

| Shortcut | Menu item | What it does |
|---|---|---|
| Cmd+N | File > New Song… | Asks for a title and artist, then creates "Title - Artist.cpm" in the open songbook (never overwriting) and opens it. With no songbook open, picks one first. |
| Cmd+O | File > Open… | Opens one song file on its own (any ChordPro type), without its folder. In the editor, asks about unsaved changes first. |
| Shift+Cmd+O | File > Open Songbook… | Picks a songbook folder. In the editor, asks about unsaved changes first, then goes back to the song list. |
| Cmd+S | File > Save | Saves the song (the editor's Save button). |
| Shift+Cmd+S | File > Save As… | Saves under a new name, and the editor switches to the new file: in the songbook folder as one of its songs, anywhere else as a song on its own. |
| Cmd+, | UkeGeeks Studio > Settings… | Which song file types the list shows (`.cpm`, `.txt`, other ChordPro extensions) and whether to reopen the last songbook. Kept in `settings.json`. |
| Cmd+L | View > Show Song List | Goes back to the song list, asking about unsaved changes first. |
| Cmd+P | File > Print… | Prints the open song as shown, with the editor's print styles (the system Print dialog picks the paper). |
| Cmd+W | File > Close Window | Closes the window, asking about unsaved changes first. |
| Cmd+Q | UkeGeeks Studio > Quit | Quits, asking about unsaved changes first (so does Quit in the Dock). |
| Cmd+Z, Shift+Cmd+Z, Cmd+X, Cmd+C, Cmd+V, Cmd+A | Edit | Undo, Redo, Cut, Copy, Paste, Select All in the text boxes. |

View > Enter Full Screen and Help (UkeGeeks Studio Help, ChordPro Reference) have no shortcuts. On Windows the shortcuts use Ctrl instead of Cmd, Quit is File > Exit, Settings… is in File, and About is in Help. The editor's own controls (themes, transpose, the Chord Builder) stay in the editor.

Editing files under `web/` reloads the window. `npm test` runs the tests for the song list code.

### How the project is laid out

| Folder | What's in it |
|---|---|
| `web/` | The app's pages: plain HTML, CSS and JavaScript, no bundler. `index.html` is the song list, `editor.html` the editor. |
| `web/js/songs.js` | Reads song titles and artists, sorts the list, saves songs. From the Songbook's `server/lib/songs.js`, changed to use Tauri's file access. |
| `web/vendor/` | The editor, Song Formatter and Ace, copied from `node_modules/` by `scripts/vendor.js` each time the app starts. Not committed. |
| `web/fonts/` | The fonts the editor's color themes use, so the app works offline. |
| `src-tauri/` | The Tauri app. `capabilities/default.json` lists what the pages may do: pick a folder, then read and write the files directly in it. `src/lib.rs` builds the menu; `src/recent.rs` keeps File > Open Recent in `recent.json` and `src/settings.rs` the settings in `settings.json` (both in `~/Library/Application Support/org.ukegeeks.studio/`). |

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
