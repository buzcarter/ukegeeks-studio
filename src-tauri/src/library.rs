//! The Library: the songbook folders the player added, each with the name the
//! player gave it (folders are often just "songs" or "cpm"), kept in `library.json`
//! in the app's config folder (next to recent.json and settings.json), with the one
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
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_fs::FsExt;

use crate::favorites::{self, FavoritesState};
use crate::paths::{folder_name, same_path as same_folder};
use crate::{platform, store};

const FILE: &str = "library.json";

/// Longest songbook name kept, in characters
const MAX_NAME: usize = 80;

/// A songbook: its folder and the name the player gave it.
#[derive(Serialize, Deserialize, Clone)]
#[serde(from = "SongbookEntry")]
pub struct Songbook {
  pub folder: String,
  pub name: String,
}

/// How a songbook is kept: { folder, name }, or (before names, task 0021) just the
/// folder, which then gets its folder's name.
#[derive(Deserialize)]
#[serde(untagged)]
enum SongbookEntry {
  Folder(String),
  Named {
    folder: String,
    #[serde(default)]
    name: String,
  },
}

impl From<SongbookEntry> for Songbook {
  fn from(entry: SongbookEntry) -> Self {
    let (folder, name) = match entry {
      SongbookEntry::Folder(folder) => (folder, String::new()),
      SongbookEntry::Named { folder, name } => (folder, name),
    };
    let name = clean_name(&name, &folder);
    Songbook { folder, name }
  }
}

/// A name as kept: spaces tidied, at most MAX_NAME characters; empty gives the
/// folder's name.
fn clean_name(name: &str, folder: &str) -> String {
  let name: String = name.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(MAX_NAME).collect();
  if name.is_empty() { folder_name(folder) } else { name }
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Library {
  /// songbooks, in the order added
  #[serde(default)]
  pub songbooks: Vec<Songbook>,
  /// the songbook selected last, shown at launch (or FAVORITES_SELECTED)
  #[serde(default)]
  pub selected: Option<String>,
}

pub struct LibraryState(Mutex<Library>);

impl LibraryState {
  /// Is this folder a songbook of the Library?
  pub fn has_songbook(&self, folder: &str) -> bool {
    self.0.lock().unwrap().songbooks.iter().any(|s| same_folder(&s.folder, folder))
  }
}

/// What `selected` holds when the sidebar's Favorites (favorites.rs) was chosen
/// last, instead of a songbook's folder (always a full path, so never this).
pub const FAVORITES_SELECTED: &str = "list:favorites";
/// Likewise for the sidebar's All Songs
pub const ALL_SELECTED: &str = "list:all";

/// Sent to every window when the Library changes (a songbook added from a song
/// window's New Song…, say); the payload is the Library.
const LIBRARY_EVENT: &str = "studio://library";

/// Reads the Library (or starts it from `recent_songbooks`) and allows its folders
/// again. Songbooks whose folders are gone stay listed (the song list says the
/// folder can't be read), so a disconnected drive doesn't empty the Library.
pub fn load(app: &AppHandle, recent_songbooks: &[String]) -> LibraryState {
  let saved: Option<Library> = store::read(app, FILE);
  let library = match saved {
    Some(library) => library,
    None => {
      let library = Library {
        songbooks: recent_songbooks
          .iter()
          .rev()
          .map(|folder| Songbook { folder: folder.clone(), name: folder_name(folder) })
          .collect(),
        selected: recent_songbooks.first().cloned(),
      };
      store::write_or_log(app, FILE, &library);
      library
    }
  };

  let scope = app.fs_scope();
  for folder in library.songbooks.iter().map(|s| &s.folder).filter(|f| Path::new(f).is_dir()) {
    if let Err(err) = scope.allow_directory(folder, false) {
      eprintln!("[studio] can't allow songbook {folder}: {err}");
    }
  }
  LibraryState(Mutex::new(library))
}

fn change(app: &AppHandle, state: &State<LibraryState>, f: impl FnOnce(&mut Library)) -> Library {
  let mut library = state.0.lock().unwrap();
  f(&mut library);
  store::write_or_log(app, FILE, &*library);
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

/// Adds a songbook (a folder just picked in the Open dialog) with the name the
/// player gave it, and selects it. Adding one that's there already renames and
/// selects it.
#[tauri::command]
pub fn library_add(app: AppHandle, state: State<LibraryState>, folder: String, name: String) -> Result<Library, String> {
  if !app.fs_scope().is_allowed(&folder) {
    return Err(format!("not a folder the app may read: {folder}"));
  }
  Ok(change(&app, &state, |library| {
    let name = clean_name(&name, &folder);
    let folder = match library.songbooks.iter_mut().find(|s| same_folder(&s.folder, &folder)) {
      Some(songbook) => {
        songbook.name = name;
        songbook.folder.clone()
      }
      None => {
        library.songbooks.push(Songbook { folder: folder.clone(), name });
        folder
      }
    };
    library.selected = Some(folder);
  }))
}

/// Gives a songbook a new name (empty: its folder's name). The folder isn't renamed.
#[tauri::command]
pub fn library_rename(app: AppHandle, state: State<LibraryState>, folder: String, name: String) -> Result<Library, String> {
  let known = state.0.lock().unwrap().songbooks.iter().any(|s| same_folder(&s.folder, &folder));
  if !known {
    return Err(format!("not in the Library: {folder}"));
  }
  Ok(change(&app, &state, |library| {
    if let Some(songbook) = library.songbooks.iter_mut().find(|s| same_folder(&s.folder, &folder)) {
      songbook.name = clean_name(&name, &songbook.folder);
    }
  }))
}

/// Takes a songbook out of the Library. The folder and its songs stay on disk.
#[tauri::command]
pub fn library_remove(app: AppHandle, state: State<LibraryState>, folder: String) -> Library {
  change(&app, &state, |library| {
    library.songbooks.retain(|s| !same_folder(&s.folder, &folder));
    if library.selected.as_deref().is_some_and(|s| same_folder(s, &folder)) {
      library.selected = None;
    }
  })
}

/// Points a songbook at another folder (right-click > Change Folder…, for a folder
/// that moved, or a drive that's named differently now). The name stays; so do its
/// favorites, which follow. The new folder is one just picked in the Open dialog.
#[tauri::command]
pub fn library_change_folder(
  app: AppHandle,
  state: State<LibraryState>,
  favorites: State<FavoritesState>,
  folder: String,
  to: String,
) -> Result<Library, String> {
  if !app.fs_scope().is_allowed(&to) {
    return Err(format!("not a folder the app may read: {to}"));
  }
  let (known, taken) = {
    let library = state.0.lock().unwrap();
    (
      library.songbooks.iter().any(|s| same_folder(&s.folder, &folder)),
      library.songbooks.iter().any(|s| same_folder(&s.folder, &to) && !same_folder(&s.folder, &folder)),
    )
  };
  if !known {
    return Err(format!("not in the Library: {folder}"));
  }
  if taken {
    return Err("That folder is already a songbook in the Library.".into());
  }
  favorites::folder_moved(&app, &favorites, &folder, &to);
  Ok(change(&app, &state, |library| {
    if let Some(songbook) = library.songbooks.iter_mut().find(|s| same_folder(&s.folder, &folder)) {
      songbook.folder = to.clone();
    }
    if library.selected.as_deref().is_some_and(|s| same_folder(s, &folder)) {
      library.selected = Some(to.clone());
    }
  }))
}

/// Shows a songbook's folder in Finder (Explorer, the file manager). Only folders
/// of the Library.
#[tauri::command]
pub fn library_reveal(state: State<LibraryState>, folder: String) -> Result<(), String> {
  if !state.has_songbook(&folder) {
    return Err(format!("not in the Library: {folder}"));
  }
  platform::open(&folder).map_err(|err| format!("can't open the folder: {err}"))
}

/// Remembers the songbook (or Favorites, FAVORITES_SELECTED) selected in the
/// sidebar, for the next launch.
#[tauri::command]
pub fn library_select(app: AppHandle, state: State<LibraryState>, folder: String) -> Result<Library, String> {
  if folder != FAVORITES_SELECTED && folder != ALL_SELECTED && !state.has_songbook(&folder) {
    return Err(format!("not in the Library: {folder}"));
  }
  Ok(change(&app, &state, |library| library.selected = Some(folder)))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn reads_old_and_new_entries() {
    let library: Library = serde_json::from_str(
      r#"{"songbooks": ["/a/cpm", {"folder": "/b/songs", "name": "  Beach   songs "}, {"folder": "/c/x"}], "selected": null}"#,
    )
    .unwrap();
    let names: Vec<&str> = library.songbooks.iter().map(|s| s.name.as_str()).collect();
    assert_eq!(names, ["cpm", "Beach songs", "x"]);
    let saved = serde_json::to_string(&library.songbooks[1]).unwrap();
    assert_eq!(saved, r#"{"folder":"/b/songs","name":"Beach songs"}"#);
  }

  #[test]
  fn names_are_tidied() {
    assert_eq!(clean_name("", "/x/songs"), "songs");
    assert_eq!(clean_name(&"a".repeat(200), "/x").chars().count(), MAX_NAME);
  }
}
