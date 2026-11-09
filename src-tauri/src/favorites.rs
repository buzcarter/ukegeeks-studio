//! Favorites: songs the player starred, from any songbook of the Library, kept in
//! `favorites.json` in the app's config folder (next to library.json).
//!
//! It's kept as lists of songs, though there's just one list today, "Favorites":
//! set lists in an order of the player's own can come later as more lists, with
//! nothing to convert. A list keeps its songs in the order they were starred; the
//! song list shows Favorites sorted by title.
//!
//! A song is its songbook's folder and its file name. Only songs of a songbook in
//! the Library can be starred (a song opened on its own is allowed for one run of
//! the app only). When a songbook leaves the Library its songs stay in the file but
//! the song list doesn't show them; adding the songbook again brings them back.
//! When a song's file is renamed (its title changed), the page says so and the
//! favorite follows.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};

use crate::library::{same_folder, LibraryState};

/// The one list there is today
pub const FAVORITES_ID: &str = "favorites";

/// Sent to every window when a star changes; the payload is the Favorites.
const FAVORITES_EVENT: &str = "studio://favorites";

/// A song: its songbook's folder and its file name.
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct ListSong {
  pub folder: String,
  pub file: String,
}

impl ListSong {
  fn is(&self, folder: &str, file: &str) -> bool {
    self.file == file && same_folder(&self.folder, folder)
  }
}

/// A list of songs, in an order of its own.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SongList {
  pub id: String,
  pub name: String,
  #[serde(default)]
  pub songs: Vec<ListSong>,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct Favorites {
  #[serde(default)]
  pub lists: Vec<SongList>,
}

impl Favorites {
  /// The Favorites list, added if it's missing.
  fn favorites(&mut self) -> &mut SongList {
    if let Some(i) = self.lists.iter().position(|l| l.id == FAVORITES_ID) {
      return &mut self.lists[i];
    }
    self.lists.insert(0, SongList { id: FAVORITES_ID.into(), name: "Favorites".into(), songs: Vec::new() });
    &mut self.lists[0]
  }

  /// Stars (adds to the end of Favorites) or unstars a song. Starring one that's
  /// starred already changes nothing.
  pub fn star(&mut self, folder: &str, file: &str, starred: bool) {
    let list = self.favorites();
    let at = list.songs.iter().position(|s| s.is(folder, file));
    match (at, starred) {
      (None, true) => list.songs.push(ListSong { folder: folder.into(), file: file.into() }),
      (Some(i), false) => {
        list.songs.remove(i);
      }
      _ => {}
    }
  }

  /// A song's file was renamed: every list follows it. If the new name is in a list
  /// already, the old entry just goes.
  pub fn rename(&mut self, folder: &str, from: &str, to: &str) {
    for list in &mut self.lists {
      if list.songs.iter().any(|s| s.is(folder, to)) {
        list.songs.retain(|s| !s.is(folder, from));
      } else if let Some(song) = list.songs.iter_mut().find(|s| s.is(folder, from)) {
        song.file = to.into();
      }
    }
  }
}

impl Favorites {
  /// A songbook's folder changed (Change Folder…): its songs follow.
  pub fn move_folder(&mut self, from: &str, to: &str) {
    for list in &mut self.lists {
      for song in list.songs.iter_mut().filter(|s| same_folder(&s.folder, from)) {
        song.folder = to.into();
      }
      let mut seen: Vec<(String, String)> = Vec::new();
      list.songs.retain(|s| {
        let key = (s.folder.to_lowercase(), s.file.clone());
        let fresh = !seen.contains(&key);
        seen.push(key);
        fresh
      });
    }
  }
}

pub struct FavoritesState(Mutex<Favorites>);

/// A songbook's folder changed: its favorites follow (no event: the Library's
/// event comes with it and the song list reads the Favorites again).
pub fn folder_moved(app: &AppHandle, state: &State<FavoritesState>, from: &str, to: &str) {
  change(app, state, |favorites| favorites.move_folder(from, to));
}

fn file_path(app: &AppHandle) -> Option<PathBuf> {
  app.path().app_config_dir().ok().map(|dir| dir.join("favorites.json"))
}

/// Reads favorites.json, or starts an empty Favorites list.
pub fn load(app: &AppHandle) -> FavoritesState {
  let mut favorites: Favorites = file_path(app)
    .and_then(|path| std::fs::read_to_string(path).ok())
    .and_then(|text| serde_json::from_str(&text).ok())
    .unwrap_or_default();
  favorites.favorites();
  FavoritesState(Mutex::new(favorites))
}

fn save(app: &AppHandle, favorites: &Favorites) {
  let Some(path) = file_path(app) else { return };
  let result = path
    .parent()
    .map_or(Ok(()), std::fs::create_dir_all)
    .and_then(|_| std::fs::write(&path, serde_json::to_string_pretty(favorites).unwrap_or_default()));
  if let Err(err) = result {
    eprintln!("[studio] can't save {}: {err}", path.display());
  }
}

fn change(app: &AppHandle, state: &State<FavoritesState>, f: impl FnOnce(&mut Favorites)) -> Favorites {
  let mut favorites = state.0.lock().unwrap();
  f(&mut favorites);
  save(app, &favorites);
  if let Err(err) = app.emit(FAVORITES_EVENT, &*favorites) {
    eprintln!("[studio] can't send the Favorites: {err}");
  }
  favorites.clone()
}

/// The Favorites (every list), for the song list and the song windows' star.
#[tauri::command]
pub fn favorites_get(state: State<FavoritesState>) -> Favorites {
  state.0.lock().unwrap().clone()
}

/// Stars or unstars a song of a songbook in the Library.
#[tauri::command]
pub fn favorites_star(
  app: AppHandle,
  state: State<FavoritesState>,
  library: State<LibraryState>,
  folder: String,
  file: String,
  starred: bool,
) -> Result<Favorites, String> {
  if starred && !library.has_songbook(&folder) {
    return Err(format!("not a songbook in the Library: {folder}"));
  }
  Ok(change(&app, &state, |favorites| favorites.star(&folder, &file, starred)))
}

/// A song's file was renamed (Save, after its title changed): its favorite follows.
#[tauri::command]
pub fn favorites_rename(app: AppHandle, state: State<FavoritesState>, folder: String, from: String, to: String) -> Favorites {
  let known = state.0.lock().unwrap().lists.iter().any(|l| l.songs.iter().any(|s| s.is(&folder, &from)));
  if !known {
    return state.0.lock().unwrap().clone();
  }
  change(&app, &state, |favorites| favorites.rename(&folder, &from, &to))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn files(favorites: &Favorites) -> Vec<String> {
    favorites.lists[0].songs.iter().map(|s| format!("{}|{}", s.folder, s.file)).collect()
  }

  #[test]
  fn an_empty_or_missing_file_gets_a_favorites_list() {
    let mut favorites: Favorites = serde_json::from_str("{}").unwrap();
    favorites.favorites();
    assert_eq!(favorites.lists.len(), 1);
    assert_eq!(favorites.lists[0].id, FAVORITES_ID);
    assert_eq!(favorites.lists[0].name, "Favorites");
  }

  #[test]
  fn keeps_other_lists() {
    let mut favorites: Favorites = serde_json::from_str(
      r#"{"lists": [{"id": "jam", "name": "Tuesday jam", "songs": [{"folder": "/a", "file": "x.cpm"}]}]}"#,
    )
    .unwrap();
    favorites.star("/a", "y.cpm", true);
    let ids: Vec<&str> = favorites.lists.iter().map(|l| l.id.as_str()).collect();
    assert_eq!(ids, [FAVORITES_ID, "jam"]);
    assert_eq!(favorites.lists[1].songs.len(), 1);
  }

  #[test]
  fn stars_and_unstars() {
    let mut favorites = Favorites::default();
    favorites.star("/a", "x.cpm", true);
    favorites.star("/b", "y.cpm", true);
    favorites.star("/a/", "x.cpm", true); // already starred (trailing slash aside)
    assert_eq!(files(&favorites), ["/a|x.cpm", "/b|y.cpm"]);
    favorites.star("/A", "x.cpm", false); // folder names ignore case
    assert_eq!(files(&favorites), ["/b|y.cpm"]);
    favorites.star("/a", "nope.cpm", false);
    assert_eq!(files(&favorites), ["/b|y.cpm"]);
  }

  #[test]
  fn a_moved_folder_takes_its_songs() {
    let mut favorites = Favorites::default();
    favorites.star("/a", "x.cpm", true);
    favorites.star("/b", "x.cpm", true);
    favorites.move_folder("/a/", "/B");
    assert_eq!(files(&favorites), ["/B|x.cpm"]);
  }

  #[test]
  fn renames_follow() {
    let mut favorites = Favorites::default();
    favorites.star("/a", "old.cpm", true);
    favorites.star("/a", "other.cpm", true);
    favorites.rename("/a", "old.cpm", "New - Me.cpm");
    assert_eq!(files(&favorites), ["/a|New - Me.cpm", "/a|other.cpm"]);
    // another folder's song of that name isn't touched
    favorites.rename("/b", "other.cpm", "x.cpm");
    assert_eq!(files(&favorites), ["/a|New - Me.cpm", "/a|other.cpm"]);
    // renamed onto a starred name: one entry left
    favorites.rename("/a", "other.cpm", "New - Me.cpm");
    assert_eq!(files(&favorites), ["/a|New - Me.cpm"]);
  }

  #[test]
  fn saves_as_lists() {
    let mut favorites = Favorites::default();
    favorites.star("/a", "x.cpm", true);
    assert_eq!(
      serde_json::to_string(&favorites).unwrap(),
      r#"{"lists":[{"id":"favorites","name":"Favorites","songs":[{"folder":"/a","file":"x.cpm"}]}]}"#
    );
  }
}
