# UkeGeeks Studio: notes for Claude

A Tauri 2 desktop app (Mac first, then Windows, later iPad) for making ukulele songbooks. It hosts the Song-a-Matic editor from `@ukegeeks/song-editor`. Plan: [docs/ROADMAP.md](docs/ROADMAP.md); task board: [docs/BOARD.md](docs/BOARD.md); why things are the way they are: [docs/DECISIONS.md](docs/DECISIONS.md). Current state, code map, testing and Tauri lessons: [docs/HANDOFF.md](docs/HANDOFF.md). What changed, PR by PR: [CHANGELOG.md](CHANGELOG.md).

## Working with the owner (Buz)

- **Tasks and branches:** work goes in numbered tasks on [docs/BOARD.md](docs/BOARD.md), one at a time. A task's branch is `feature/task-NNNN_short-name` (or `bugfix/task-NNNN_…`), for example `feature/task-0023_make-new-pickles`. New tasks take the next number; numbers never change when tasks are reordered. The task's PR updates the board (Doing → Done, with the PR number).
- **Branches:** always edit on a `feature/…` or `bugfix/…` branch, never on `main`. Check the branch before the first edit and again before every commit: the owner merges PRs and switches checkouts to `main` mid-session.
- **Commits:** one commit per finished chunk of work, not one big commit at the end. One PR per piece of work. Merge stacked PRs with "Create a merge commit", not squash.
- **The owner pushes, publishes to npm, creates releases and changes GitHub settings.** Prepare the exact commands; don't run them.
- **Commands for the owner to run:** in the Claude desktop app, commands the owner types with `!` always run in the session's folder, not where the last one ran. Start every command meant for another repo with `cd ~/Code/<repo> &&`.
- **Indentation:** 2 spaces, no tabs, in new code. Code copied unchanged from older UkeGeeks repos keeps its tabs: match the file.
- **Markdown:** a blank line between paragraphs.
- **"Move, don't rewrite":** when bringing in existing UkeGeeks code (song parsing, the editor), keep it the same and change it in a separate step.
- **No PHP** on this machine (only relevant to the Songbook repo).
- **Disk space is tight:** about 10 GB free on 2026-11-07 (`src-tauri/target/` was 2.3 GB). Tauri's `src-tauri/target/` folder grows by several GB; say so before anything that builds a lot (release builds, extra Rust targets), and `cargo clean` when it's no longer needed.

## Machine

- macOS on Apple Silicon. Rust 1.99.1 (`aarch64-apple-darwin` only), Node 24.14, npm 11.9.
- Xcode **Command Line Tools only** (no full Xcode): enough for macOS builds, not for iPad.
- The owner is signed in to `gh` and npm as `buzcarter`. npm publishing asks for a browser sign-in.

## Related checkouts

| Repo | Local folder | Default branch |
|---|---|---|
| buzcarter/ukegeeks-studio (this) | `~/Code/ukegeeks-studio` | `main` |
| buzcarter/song-editor | `~/Code/ukegeeks-unnamed-editor-project` (folder keeps its old name) | `main` |
| buzcarter/song-formatter | `~/Code/ugs-song-formatter` (`~/Code/song-formatter` is a stale copy) | `master` |
| buzcarter/ace-chordpro-extension | `~/Code/ugs-ace-chordpro-extension` | `main` |
| buzcarter/UkeGeeks (the Songbook) | `~/Code/UkeGeeks` | `main` |
| buzcarter/ukegeeks-org-site (private) | `~/Sites/ukegeeks.org/public_html` | |

All are GPL-3.0.
