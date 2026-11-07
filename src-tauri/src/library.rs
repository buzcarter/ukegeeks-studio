//! The Library: the songbook folders the player added, kept in `library.json` in
//! the app's config folder (next to recent.json and settings.json), with the one
//! last selected. The song list shows them in a sidebar.
//!
//! As with Open Recent, folder access normally lasts one run of the app, so at
//! startup each songbook in the Library is allowed again (the folder and the files
//! directly in it, as the Open dialog does). Only folders the app may already read
//! (just picked in the Open dialog) can be added, so the pages can't use the
//! Library to reach other folders. Removing a songbook takes it out of the file; the
//! next launch no longer allows it. Nothing on disk is touched.
//!
//! The first time (no library.json yet), the Library starts with the songbooks
//! from Open Recent, which now lists songs only.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_fs::FsExt;

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Library {
  /// songbook folders, in the order added
  #[serde(default)]
  pub songbooks: Vec<String>,
  /// the songbook selected last, shown at launch
  #[serde(default)]
  pub selected: Option<String>,
}

pub struct LibraryState(Mutex<Library>);

/// Sent to every window when the Library changes (a songbook added from a song
/// window's New Song…, say); the payload is the Library.
const LIBRARY_EVENT: &str = "studio://library";

fn file_path(app: &AppHandle) -> Option<PathBuf> {
  app.path().app_config_dir().ok().map(|dir| dir.join("library.json"))
}

/// The same folder? Trailing slashes aside, and ignoring case, as Mac and Windows
/// folder names do.
fn same_folder(a: &str, b: &str) -> bool {
  let clean = |p: &str| p.trim_end_matches(['/', '\\']).to_lowercase();
  clean(a) == clean(b)
}

/// Reads the Library (or starts it from `recent_songbooks`) and allows its folders
/// again. Songbooks whose folders are gone stay listed (the song list says the
/// folder can't be read), so a disconnected drive doesn't empty the Library.
pub fn load(app: &AppHandle, recent_songbooks: &[String]) -> LibraryState {
  let saved: Option<Library> = file_path(app)
    .and_then(|path| std::fs::read_to_string(path).ok())
    .and_then(|text| serde_json::from_str(&text).ok());
  let library = match saved {
    Some(library) => library,
    None => {
      let library = Library {
        songbooks: recent_songbooks.iter().rev().cloned().collect(),
        selected: recent_songbooks.first().cloned(),
      };
      save(app, &library);
      library
    }
  };

  let scope = app.fs_scope();
  for folder in library.songbooks.iter().filter(|f| Path::new(f).is_dir()) {
    if let Err(err) = scope.allow_directory(folder, false) {
      eprintln!("[studio] can't allow songbook {folder}: {err}");
    }
  }
  LibraryState(Mutex::new(library))
}

fn save(app: &AppHandle, library: &Library) {
  let Some(path) = file_path(app) else { return };
  let result = path
    .parent()
    .map_or(Ok(()), std::fs::create_dir_all)
    .and_then(|_| std::fs::write(&path, serde_json::to_string_pretty(library).unwrap_or_default()));
  if let Err(err) = result {
    eprintln!("[studio] can't save {}: {err}", path.display());
  }
}

fn change(app: &AppHandle, state: &State<LibraryState>, f: impl FnOnce(&mut Library)) -> Library {
  let mut library = state.0.lock().unwrap();
  f(&mut library);
  save(app, &library);
  if let Err(err) = app.emit(LIBRARY_EVENT, &*library) {
    eprintln!("[studio] can't send the Library: {err}");
  }
  library.clone()
}

/// The Library, for the song list.
#[tauri::command]
pub fn library_get(state: State<LibraryState>) -> Library {
  state.0.lock().unwrap().clone()
}

/// Adds a songbook (a folder just picked in the Open dialog) and selects it. Adding
/// one that's there already just selects it.
#[tauri::command]
pub fn library_add(app: AppHandle, state: State<LibraryState>, folder: String) -> Result<Library, String> {
  if !app.fs_scope().is_allowed(&folder) {
    return Err(format!("not a folder the app may read: {folder}"));
  }
  Ok(change(&app, &state, |library| {
    let existing = library.songbooks.iter().find(|f| same_folder(f, &folder)).cloned();
    let folder = existing.unwrap_or_else(|| {
      library.songbooks.push(folder.clone());
      folder
    });
    library.selected = Some(folder);
  }))
}

/// Takes a songbook out of the Library. The folder and its songs stay on disk.
#[tauri::command]
pub fn library_remove(app: AppHandle, state: State<LibraryState>, folder: String) -> Library {
  change(&app, &state, |library| {
    library.songbooks.retain(|f| !same_folder(f, &folder));
    if library.selected.as_deref().is_some_and(|s| same_folder(s, &folder)) {
      library.selected = None;
    }
  })
}

/// Remembers the songbook selected in the sidebar, for the next launch.
#[tauri::command]
pub fn library_select(app: AppHandle, state: State<LibraryState>, folder: String) -> Result<Library, String> {
  let known = state.0.lock().unwrap().songbooks.iter().any(|f| same_folder(f, &folder));
  if !known {
    return Err(format!("not in the Library: {folder}"));
  }
  Ok(change(&app, &state, |library| library.selected = Some(folder)))
}
