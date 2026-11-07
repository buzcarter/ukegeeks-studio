//! The app's settings, kept in `settings.json` in the app's config folder (next to
//! recent.json) and read and written by the pages through `settings_get` and
//! `settings_set`. The Settings window (web/settings.html) is opened from the menu:
//! UkeGeeks Studio > Settings… on a Mac, File > Settings… on Windows (Cmd/Ctrl+,).
//!
//! When the settings change, every window gets a `studio://settings` event with
//! them, so the song list can list the songs again.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

const SETTINGS_EVENT: &str = "studio://settings";
pub const SETTINGS_WINDOW: &str = "settings";

/// Song file extensions the song list may show. ".txt" also covers the Songbook's
/// ".cpm.txt" (the pages add it). The rest are ChordPro's other common extensions
/// (chordpro.org); ".cho" is ChordPro's recommended default.
const KNOWN_EXTENSIONS: [&str; 8] = [".cpm", ".txt", ".cho", ".crd", ".chopro", ".chord", ".chordpro", ".pro"];

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
  /// which song files the list shows, from KNOWN_EXTENSIONS
  pub song_extensions: Vec<String>,
  /// open the last songbook when the app starts
  pub reopen_last_songbook: bool,
}

impl Default for Settings {
  fn default() -> Self {
    Settings { song_extensions: vec![".cpm".into()], reopen_last_songbook: true }
  }
}

impl Settings {
  /// Known extensions only, in KNOWN_EXTENSIONS order, at least one.
  fn cleaned(mut self) -> Self {
    let wanted: Vec<String> = self.song_extensions.iter().map(|ext| ext.to_lowercase()).collect();
    self.song_extensions = KNOWN_EXTENSIONS
      .iter()
      .filter(|ext| wanted.iter().any(|w| w == *ext))
      .map(|ext| ext.to_string())
      .collect();
    if self.song_extensions.is_empty() {
      self.song_extensions = Settings::default().song_extensions;
    }
    self
  }
}

pub struct SettingsState(Mutex<Settings>);

fn file_path(app: &AppHandle) -> Option<PathBuf> {
  app.path().app_config_dir().ok().map(|dir| dir.join("settings.json"))
}

pub fn load(app: &AppHandle) -> SettingsState {
  let settings: Settings = file_path(app)
    .and_then(|path| std::fs::read_to_string(path).ok())
    .and_then(|text| serde_json::from_str(&text).ok())
    .unwrap_or_default();
  SettingsState(Mutex::new(settings.cleaned()))
}

fn save(app: &AppHandle, settings: &Settings) -> Result<(), String> {
  let path = file_path(app).ok_or("no config folder")?;
  path
    .parent()
    .map_or(Ok(()), std::fs::create_dir_all)
    .and_then(|_| std::fs::write(&path, serde_json::to_string_pretty(settings).unwrap_or_default()))
    .map_err(|err| format!("can't save {}: {err}", path.display()))
}

#[tauri::command]
pub fn settings_get(state: State<SettingsState>) -> Settings {
  state.0.lock().unwrap().clone()
}

/// Saves new settings and tells every window. Returns them as kept (cleaned up).
#[tauri::command]
pub fn settings_set(app: AppHandle, state: State<SettingsState>, settings: Settings) -> Result<Settings, String> {
  let settings = settings.cleaned();
  save(&app, &settings)?;
  *state.0.lock().unwrap() = settings.clone();
  if let Err(err) = app.emit(SETTINGS_EVENT, &settings) {
    eprintln!("[studio] can't send the new settings: {err}");
  }
  Ok(settings)
}

/// Shows the Settings window, opening it if needed.
pub fn show_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window(SETTINGS_WINDOW) {
    let _ = window.unminimize();
    let _ = window.set_focus();
    return;
  }
  let built = WebviewWindowBuilder::new(app, SETTINGS_WINDOW, WebviewUrl::App("settings.html".into()))
    .title("Settings")
    .inner_size(520.0, 420.0)
    .resizable(false)
    .minimizable(false)
    .maximizable(false)
    .build();
  if let Err(err) = built {
    eprintln!("[studio] can't open Settings: {err}");
  }
}
