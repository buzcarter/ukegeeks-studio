//! Recent songbooks and songs: File > Open Recent, kept across launches in
//! `recent.json` in the app's config folder
//! (~/Library/Application Support/org.ukegeeks.studio/ on a Mac).
//!
//! Folder access normally lasts one run of the app: the Open dialog adds the folder
//! to the fs plugin's scope. At startup the folders in this list are added again, so
//! a recent songbook opens without the dialog. Only folders the dialog already
//! allowed get into the list (`recent_add_songbook` checks), so the pages can't use
//! it to reach other folders. Clearing the menu takes the folders out of the list,
//! and the next launch no longer allows them.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::menu::{IsMenuItem, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, State, Wry};
use tauri_plugin_fs::FsExt;

const MAX_ITEMS: usize = 10;

/// Sent to the page when a recent item is chosen; payload: { folder, song } (song is
/// a filename, or null for a songbook).
const OPEN_RECENT_EVENT: &str = "studio://open-recent";

const SONGBOOK_ID: &str = "recent-songbook-";
const SONG_ID: &str = "recent-song-";
const CLEAR_ID: &str = "recent-clear";

#[derive(Serialize, Deserialize, Clone, PartialEq)]
pub struct RecentSong {
  pub folder: String,
  pub filename: String,
  pub title: String,
  /// opened on its own (File > Open…): the app may read the file, not its folder
  #[serde(default)]
  pub single: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct Recent {
  /// most recent first
  #[serde(default)]
  pub songbooks: Vec<String>,
  #[serde(default)]
  pub songs: Vec<RecentSong>,
}

#[derive(Serialize, Clone)]
struct OpenRecent {
  folder: String,
  song: Option<String>,
  single: bool,
}

pub struct RecentState {
  list: Mutex<Recent>,
  menu: Mutex<Option<Submenu<Wry>>>,
}

fn file_path(app: &AppHandle) -> Option<PathBuf> {
  app.path().app_config_dir().ok().map(|dir| dir.join("recent.json"))
}

/// Reads the list, drops what no longer exists, and allows its folders again.
pub fn load(app: &AppHandle) -> RecentState {
  let mut recent: Recent = file_path(app)
    .and_then(|path| std::fs::read_to_string(path).ok())
    .and_then(|text| serde_json::from_str(&text).ok())
    .unwrap_or_default();

  recent.songbooks.retain(|folder| Path::new(folder).is_dir());
  recent.songs.retain(|song| Path::new(&song.folder).join(&song.filename).is_file());

  let scope = app.fs_scope();
  let folders = recent.songbooks.iter().chain(recent.songs.iter().filter(|s| !s.single).map(|s| &s.folder));
  for folder in folders {
    // as the Open dialog does: the folder and the files directly in it
    if let Err(err) = scope.allow_directory(folder, false) {
      eprintln!("[studio] can't allow recent folder {folder}: {err}");
    }
  }
  // songs opened on their own: just the file, as the Open dialog does
  for song in recent.songs.iter().filter(|s| s.single) {
    if let Err(err) = scope.allow_file(Path::new(&song.folder).join(&song.filename)) {
      eprintln!("[studio] can't allow recent song {}: {err}", song.filename);
    }
  }

  RecentState { list: Mutex::new(recent), menu: Mutex::new(None) }
}

fn save(app: &AppHandle, recent: &Recent) {
  let Some(path) = file_path(app) else { return };
  let result = path
    .parent()
    .map_or(Ok(()), std::fs::create_dir_all)
    .and_then(|_| std::fs::write(&path, serde_json::to_string_pretty(recent).unwrap_or_default()));
  if let Err(err) = result {
    eprintln!("[studio] can't save {}: {err}", path.display());
  }
}

/// The folder's last part ("cpm" for ".../UkeGeeks/cpm").
fn folder_name(folder: &str) -> String {
  Path::new(folder)
    .file_name()
    .map(|name| name.to_string_lossy().into_owned())
    .unwrap_or_else(|| folder.to_string())
}

/// Labels for the menu; when two are the same, each gets its folder's name (or
/// for songbooks, the parent folder's) after a dash.
fn labels(names: &[String], extras: &[String]) -> Vec<String> {
  names
    .iter()
    .zip(extras)
    .map(|(name, extra)| {
      let twins = names.iter().filter(|other| *other == name).count() > 1;
      if twins { format!("{name} — {extra}") } else { name.clone() }
    })
    .collect()
}

/// The File > Open Recent submenu, filled in by `refresh_menu`.
pub fn build_submenu(app: &AppHandle, state: &RecentState) -> tauri::Result<Submenu<Wry>> {
  let submenu = Submenu::new(app, "Open Recent", true)?;
  *state.menu.lock().unwrap() = Some(submenu.clone());
  refresh_menu(app, state);
  Ok(submenu)
}

fn refresh_menu(app: &AppHandle, state: &RecentState) {
  let Some(submenu) = state.menu.lock().unwrap().clone() else { return };
  let recent = state.list.lock().unwrap().clone();
  if let Err(err) = fill_submenu(app, &submenu, &recent) {
    eprintln!("[studio] can't update Open Recent: {err}");
  }
}

fn fill_submenu(app: &AppHandle, submenu: &Submenu<Wry>, recent: &Recent) -> tauri::Result<()> {
  while submenu.remove_at(0)?.is_some() {}

  let mut items: Vec<Box<dyn IsMenuItem<Wry>>> = Vec::new();
  let heading = |text: &str| MenuItem::new(app, text, false, None::<&str>);

  if !recent.songbooks.is_empty() {
    items.push(Box::new(heading("Songbooks")?));
    let names: Vec<String> = recent.songbooks.iter().map(|f| folder_name(f)).collect();
    let parents: Vec<String> = recent
      .songbooks
      .iter()
      .map(|f| Path::new(f).parent().map(|p| folder_name(&p.to_string_lossy())).unwrap_or_default())
      .collect();
    for (i, label) in labels(&names, &parents).into_iter().enumerate() {
      items.push(Box::new(MenuItem::with_id(app, format!("{SONGBOOK_ID}{i}"), label, true, None::<&str>)?));
    }
  }

  if !recent.songs.is_empty() {
    if !items.is_empty() {
      items.push(Box::new(PredefinedMenuItem::separator(app)?));
    }
    items.push(Box::new(heading("Songs")?));
    let titles: Vec<String> = recent.songs.iter().map(|s| s.title.clone()).collect();
    let folders: Vec<String> = recent.songs.iter().map(|s| folder_name(&s.folder)).collect();
    for (i, label) in labels(&titles, &folders).into_iter().enumerate() {
      items.push(Box::new(MenuItem::with_id(app, format!("{SONG_ID}{i}"), label, true, None::<&str>)?));
    }
  }

  if !items.is_empty() {
    items.push(Box::new(PredefinedMenuItem::separator(app)?));
  }
  let has_items = !items.is_empty();
  items.push(Box::new(MenuItem::with_id(app, CLEAR_ID, "Clear Menu", has_items, None::<&str>)?));

  for item in &items {
    submenu.append(item.as_ref())?;
  }
  Ok(())
}

fn update(app: &AppHandle, state: &RecentState, change: impl FnOnce(&mut Recent)) {
  {
    let mut recent = state.list.lock().unwrap();
    change(&mut recent);
    recent.songbooks.truncate(MAX_ITEMS);
    recent.songs.truncate(MAX_ITEMS);
    save(app, &recent);
  }
  refresh_menu(app, state);
}

/// Handles an Open Recent item. Returns false for ids that aren't one.
pub fn on_menu_event(app: &AppHandle, id: &str) -> bool {
  let state = app.state::<RecentState>();
  let open = if id == CLEAR_ID {
    update(app, &state, |recent| *recent = Recent::default());
    return true;
  } else if let Some(i) = id.strip_prefix(SONGBOOK_ID).and_then(|i| i.parse::<usize>().ok()) {
    let recent = state.list.lock().unwrap();
    recent.songbooks.get(i).map(|folder| OpenRecent { folder: folder.clone(), song: None, single: false })
  } else if let Some(i) = id.strip_prefix(SONG_ID).and_then(|i| i.parse::<usize>().ok()) {
    let recent = state.list.lock().unwrap();
    recent.songs.get(i).map(|s| OpenRecent { folder: s.folder.clone(), song: Some(s.filename.clone()), single: s.single })
  } else {
    return false;
  };
  if let Some(open) = open {
    if let Err(err) = app.emit(OPEN_RECENT_EVENT, open) {
      eprintln!("[studio] can't send Open Recent to the page: {err}");
    }
  }
  true
}

/// The recent lists, for the pages.
#[tauri::command]
pub fn recent_list(state: State<RecentState>) -> Recent {
  state.list.lock().unwrap().clone()
}

/// Puts a songbook at the top of the list. Only a folder the app may already read
/// (picked in the Open dialog, or already recent).
#[tauri::command]
pub fn recent_add_songbook(app: AppHandle, state: State<RecentState>, folder: String) -> Result<(), String> {
  if !app.fs_scope().is_allowed(&folder) {
    return Err(format!("not an open folder: {folder}"));
  }
  update(&app, &state, |recent| {
    recent.songbooks.retain(|f| *f != folder);
    recent.songbooks.insert(0, folder);
  });
  Ok(())
}

/// Puts a song at the top of the list. Only a file directly in a folder the app may
/// already read, or (single) a file the app may read on its own.
#[tauri::command]
pub fn recent_add_song(
  app: AppHandle,
  state: State<RecentState>,
  folder: String,
  filename: String,
  title: String,
  single: bool,
) -> Result<(), String> {
  let bare = !filename.is_empty() && !filename.starts_with('.') && !filename.contains(['/', '\\']);
  let allowed = if single {
    app.fs_scope().is_allowed(Path::new(&folder).join(&filename))
  } else {
    app.fs_scope().is_allowed(&folder)
  };
  if !bare || !allowed {
    return Err(format!("not a song the app may open: {filename}"));
  }
  let title = if title.trim().is_empty() { "Untitled".into() } else { title };
  let song = RecentSong { folder, filename, title, single };
  update(&app, &state, |recent| {
    recent.songs.retain(|s| !(s.folder == song.folder && s.filename == song.filename));
    recent.songs.insert(0, song);
  });
  Ok(())
}
