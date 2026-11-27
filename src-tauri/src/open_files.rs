//! Songs opened from outside the app: double-clicking a song file or using Open With
//! (the file associations in tauri.conf.json), dropping one on the Dock icon, or, on
//! Windows and Linux, a path on the command line (a second launch hands its command
//! line to the running app: tauri-plugin-single-instance). Each song opens in its own
//! window on its own, as with File > Open…, and the app may read and save that file.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;

use crate::settings::KNOWN_EXTENSIONS;
use crate::windows;

/// Songs that arrived before the app finished starting. A Mac sends the files a
/// launch was for before it says the app has launched, so before `setup()` has
/// made the windows' state; opening then would panic.
static WAITING: Mutex<Vec<PathBuf>> = Mutex::new(Vec::new());

/// Opens each song file in its own window (or brings its window forward). Anything
/// that isn't a file with a ChordPro extension is skipped. Before the app has
/// started, the files wait for `open_waiting()`.
pub fn open_paths(app: &AppHandle, paths: Vec<PathBuf>) {
  if app.try_state::<windows::WindowsState>().is_none() {
    WAITING.lock().unwrap().extend(paths);
    return;
  }
  for path in paths {
    if !path.is_file() || !is_song_file(&path) {
      eprintln!("[studio] not a song file, not opened: {}", path.display());
      continue;
    }
    if let Err(err) = app.fs_scope().allow_file(&path) {
      eprintln!("[studio] can't allow {}: {err}", path.display());
      continue;
    }
    let text = path.to_string_lossy();
    let url = format!("editor.html?file={}", windows::encode(&text));
    if let Err(err) = windows::open_song(app, &text, &url) {
      eprintln!("[studio] {err}");
    }
  }
}

/// Opens the songs that arrived while the app was starting; the end of `setup()`.
pub fn open_waiting(app: &AppHandle) {
  let paths = std::mem::take(&mut *WAITING.lock().unwrap());
  if !paths.is_empty() {
    open_paths(app, paths);
  }
}

/// A song file by its extension: one of Settings' song file types (".cpm.txt" counts
/// as ".txt"), in any case.
pub fn is_song_file(path: &Path) -> bool {
  let name = path.file_name().map(|n| n.to_string_lossy().to_lowercase()).unwrap_or_default();
  KNOWN_EXTENSIONS.iter().any(|ext| name.len() > ext.len() && name.ends_with(ext))
}

/// The files on a command line (`args` without the program itself): options are
/// skipped, relative paths are taken from `cwd`.
#[cfg_attr(any(target_os = "macos", target_os = "ios"), allow(dead_code))]
pub fn paths_from_args<I: IntoIterator<Item = String>>(args: I, cwd: &Path) -> Vec<PathBuf> {
  args
    .into_iter()
    .filter(|arg| !arg.starts_with('-'))
    .map(|arg| {
      let path = PathBuf::from(arg);
      if path.is_absolute() {
        path
      } else {
        cwd.join(path)
      }
    })
    .collect()
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn song_files_by_extension() {
    assert!(is_song_file(Path::new("/songs/Hey Jude - The Beatles.cpm")));
    assert!(is_song_file(Path::new("/songs/Old Song.cpm.txt")));
    assert!(is_song_file(Path::new("C:\\Songs\\LOUD.CHO")));
    assert!(!is_song_file(Path::new("/songs/cover.png")));
    assert!(!is_song_file(Path::new("/songs/.cpm")));
    assert!(!is_song_file(Path::new("/songs/cpm")));
  }

  #[test]
  fn command_line_paths() {
    let cwd = Path::new("/home/player");
    let args = ["--flag", "songs/a.cpm", "/abs/b.cho"].map(String::from);
    assert_eq!(
      paths_from_args(args, cwd),
      vec![PathBuf::from("/home/player/songs/a.cpm"), PathBuf::from("/abs/b.cho")]
    );
  }
}
