//! The app's windows: `main` (the song list) and one window per open song
//! (`song-1`, `song-2`, …), plus Settings (settings.rs).
//!
//! - **Opening a song** (`open_song_window`) opens a window for it, or brings its
//!   window forward if it's already open. Each song window tells Rust which file it
//!   holds (`song_window_path`), since Save As and renames change it.
//! - **The Edit window** (`edit-1` for `song-1`, …; `open_edit_window`) is a song's
//!   text in the Ace editor, beside its song window. The two pages talk to each
//!   other (web/js/lib/edit-window.js); the song window owns the song. It closes
//!   with its song window, and a menu item chosen in it goes to its song window.
//! - **Menu items** go to the window in front (`send_menu`), not to every window: a
//!   page's plain `listen` hears events sent to any window, so the pages listen for
//!   events sent to their own label (web/js/lib/menu.js).
//! - **Quit** asks each song window in turn about unsaved changes (`request_quit`):
//!   the window answers with `quit` (go on) or `quit_cancel` (stop quitting). When
//!   every song window has said yes, the app ends.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::paths::same_path;

pub const MAIN_WINDOW: &str = "main";
const SONG_PREFIX: &str = "song-";
const EDIT_PREFIX: &str = "edit-";

/// Tells a song window that its Edit window closed.
const EDIT_CLOSED_EVENT: &str = "studio://edit-closed";
const EDIT_WIDTH: f64 = 760.0;

/// The event the pages listen for; the payload is the menu item's id.
pub const MENU_EVENT: &str = "studio://menu";
const QUIT: &str = "quit";

/// How far each new song window sits from the one in front, in points
const CASCADE: f64 = 28.0;

#[derive(Default)]
pub struct WindowsState {
  /// song window label → the file it holds
  songs: Mutex<HashMap<String, String>>,
  next: AtomicU32,
  quit: Mutex<Quitting>,
}

#[derive(Default)]
struct Quitting {
  /// quitting now
  active: bool,
  /// song windows still to ask
  queue: Vec<String>,
  /// the song window asked last, whose answer is awaited
  asking: Option<String>,
}

pub fn is_song_window(label: &str) -> bool {
  label.starts_with(SONG_PREFIX)
}

/// A song window's Edit window: `edit-3` for `song-3`.
fn edit_label(song_label: &str) -> Option<String> {
  song_label.strip_prefix(SONG_PREFIX).map(|n| format!("{EDIT_PREFIX}{n}"))
}

/// An Edit window's song window: `song-3` for `edit-3`.
fn song_label(edit_label: &str) -> Option<String> {
  edit_label.strip_prefix(EDIT_PREFIX).map(|n| format!("{SONG_PREFIX}{n}"))
}

/// The song list or a song window (not Settings)
fn is_page_window(label: &str) -> bool {
  label == MAIN_WINDOW || is_song_window(label)
}

/// The song list or song window in front, if any
fn focused_page_window(app: &AppHandle) -> Option<WebviewWindow> {
  app
    .webview_windows()
    .into_values()
    .find(|w| is_page_window(w.label()) && w.is_focused().unwrap_or(false))
}

/// The window a menu item is for: the song list or song window in front, or the
/// song window of the Edit window in front.
fn front_page_window(app: &AppHandle) -> Option<WebviewWindow> {
  let front = app.webview_windows().into_values().find(|w| w.is_focused().unwrap_or(false))?;
  if is_page_window(front.label()) {
    return Some(front);
  }
  song_label(front.label()).and_then(|label| app.get_webview_window(&label))
}

fn bring_forward(window: &WebviewWindow) {
  let _ = window.unminimize();
  let _ = window.show();
  let _ = window.set_focus();
}

/// Percent-encodes a value for a page's query string (like encodeURIComponent).
pub fn encode(value: &str) -> String {
  let mut out = String::new();
  for byte in value.bytes() {
    match byte {
      b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'!' | b'~' | b'*' | b'\'' | b'(' | b')' => {
        out.push(byte as char)
      }
      _ => out.push_str(&format!("%{byte:02X}")),
    }
  }
  out
}

/// Brings the song list forward, opening it (index.html?<query>) if it was closed.
/// Returns true if it was already open, so the caller can send it an event; a newly
/// opened list reads its query instead (`open=1`, `folder=…`).
pub fn show_main(app: &AppHandle, query: &str) -> bool {
  if let Some(window) = app.get_webview_window(MAIN_WINDOW) {
    bring_forward(&window);
    return true;
  }
  let url = if query.is_empty() { "index.html".to_string() } else { format!("index.html?{query}") };
  // as in tauri.conf.json
  let built = WebviewWindowBuilder::new(app, MAIN_WINDOW, WebviewUrl::App(url.into()))
    .title("UkeGeeks Studio")
    .inner_size(1200.0, 850.0)
    .min_inner_size(800.0, 600.0)
    .build();
  if let Err(err) = built {
    eprintln!("[studio] can't open the song list: {err}");
  }
  false
}

/// Sends a menu item to the window in front (from an Edit window, to its song
/// window: Save there saves the song); if that's Settings or nothing, to the
/// song list, or failing that, to a song window. (Save, Save As and Print mean
/// something only in a song window; the song list ignores them.)
pub fn send_menu(app: &AppHandle, id: &str) {
  let target = front_page_window(app)
    .or_else(|| app.get_webview_window(MAIN_WINDOW))
    .or_else(|| app.webview_windows().into_values().find(|w| is_song_window(w.label())));
  match target {
    Some(window) => {
      if let Err(err) = app.emit_to(window.label(), MENU_EVENT, id) {
        eprintln!("[studio] can't send menu item {id} to {}: {err}", window.label());
      }
    }
    // no windows (on a Mac the app keeps running without any) or only Settings:
    // open the song list, which then does New Song… or Open… itself (?menu=)
    None => {
      let query = if ["new-song", "open-file"].contains(&id) { format!("menu={id}") } else { String::new() };
      show_main(app, &query);
    }
  }
}

/// Sends an event to the song list, opening it with `query` if it was closed.
pub fn send_to_main<S: serde::Serialize + Clone>(app: &AppHandle, query: &str, event: &str, payload: S) {
  if show_main(app, query) {
    if let Err(err) = app.emit_to(MAIN_WINDOW, event, payload) {
      eprintln!("[studio] can't send {event} to the song list: {err}");
    }
  }
}

/// Opens a song in its own window (`url` is the editor page, "editor.html?…"), or
/// brings forward the window that already has `path`.
pub fn open_song(app: &AppHandle, path: &str, url: &str) -> Result<(), String> {
  if !url.starts_with("editor.html?") {
    return Err(format!("not a song page: {url}"));
  }
  let state = app.state::<WindowsState>();
  let open = {
    let songs = state.songs.lock().unwrap();
    songs.iter().find(|(_, p)| same_path(p, path)).map(|(label, _)| label.clone())
  };
  if let Some(window) = open.and_then(|label| app.get_webview_window(&label)) {
    bring_forward(&window);
    return Ok(());
  }

  let label = format!("{SONG_PREFIX}{}", state.next.fetch_add(1, Ordering::SeqCst) + 1);
  let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::App(url.into()))
    .title("UkeGeeks Studio")
    .inner_size(1100.0, 850.0)
    .min_inner_size(800.0, 600.0);
  // a little below and right of the window in front, so it doesn't hide it exactly
  if let Some(front) = focused_page_window(app) {
    if let (Ok(pos), Ok(scale)) = (front.outer_position(), front.scale_factor()) {
      let pos = pos.to_logical::<f64>(scale);
      builder = builder.position(pos.x + CASCADE, pos.y + CASCADE);
    }
  }
  // known before the page loads, so a second click doesn't open it twice
  state.songs.lock().unwrap().insert(label.clone(), path.to_string());
  if let Err(err) = builder.build() {
    state.songs.lock().unwrap().remove(&label);
    return Err(format!("can't open a window for {path}: {err}"));
  }
  Ok(())
}

/// The pages open songs through this: `path` is the song's file, `url` its editor
/// page ("editor.html?folder=…&song=…" or "editor.html?file=…").
#[tauri::command]
pub fn open_song_window(app: AppHandle, path: String, url: String) -> Result<(), String> {
  open_song(&app, &path, &url)
}

/// Where a window `width` wide goes to sit beside `window`: at its right edge, or
/// as far right as the screen allows (then it overlaps). None if the screen can't be read.
fn beside(window: &WebviewWindow, width: f64) -> Option<(f64, f64)> {
  let scale = window.scale_factor().ok()?;
  let pos = window.outer_position().ok()?.to_logical::<f64>(scale);
  let size = window.outer_size().ok()?.to_logical::<f64>(scale);
  let monitor = window.current_monitor().ok()??;
  let screen_pos = monitor.position().to_logical::<f64>(monitor.scale_factor());
  let screen_size = monitor.size().to_logical::<f64>(monitor.scale_factor());
  let x = (pos.x + size.width).min(screen_pos.x + screen_size.width - width).max(screen_pos.x);
  Some((x, pos.y))
}

/// A song window's Edit button: opens its Edit window (the song's text in the Ace
/// editor, edit-window.html) beside it, or brings it forward.
#[tauri::command]
pub fn open_edit_window(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
  let label = edit_label(window.label()).ok_or_else(|| format!("not a song window: {}", window.label()))?;
  if let Some(open) = app.get_webview_window(&label) {
    bring_forward(&open);
    return Ok(());
  }
  let mut builder = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("edit-window.html".into()))
    .title("Edit Song")
    .inner_size(EDIT_WIDTH, 850.0)
    .min_inner_size(420.0, 320.0);
  if let Some((x, y)) = beside(&window, EDIT_WIDTH) {
    builder = builder.position(x, y);
  }
  builder.build().map(|_| ()).map_err(|err| format!("can't open the Edit window: {err}"))
}

/// A song window says which file it holds (when it opens, and after a rename or
/// Save As).
#[tauri::command]
pub fn song_window_path(window: tauri::Window, state: State<WindowsState>, path: String) {
  if is_song_window(window.label()) {
    state.songs.lock().unwrap().insert(window.label().to_string(), path);
  }
}

/// Quit, Cmd+Q or from the Dock: asks each song window about unsaved changes, one at
/// a time, then ends the app. While a song window is being asked, asking again just
/// brings it forward.
pub fn request_quit(app: &AppHandle) {
  let state = app.state::<WindowsState>();
  {
    let mut quit = state.quit.lock().unwrap();
    if quit.active {
      if let Some(window) = quit.asking.as_deref().and_then(|label| app.get_webview_window(label)) {
        bring_forward(&window);
      }
      return;
    }
    let mut queue: Vec<String> = state.songs.lock().unwrap().keys().cloned().collect();
    queue.sort();
    *quit = Quitting { active: true, queue, asking: None };
  }
  ask_next(app);
}

/// Asks the next song window, or ends the app when none are left.
fn ask_next(app: &AppHandle) {
  let state = app.state::<WindowsState>();
  loop {
    let label = {
      let mut quit = state.quit.lock().unwrap();
      if !quit.active {
        return;
      }
      if quit.queue.is_empty() {
        quit.asking = None;
        None
      } else {
        let label = quit.queue.remove(0);
        quit.asking = Some(label.clone());
        Some(label)
      }
    };
    let Some(label) = label else {
      crate::exit_app(app);
      return;
    };
    // a window closed meanwhile has nothing to ask
    let Some(window) = app.get_webview_window(&label) else { continue };
    bring_forward(&window);
    match app.emit_to(label.as_str(), MENU_EVENT, QUIT) {
      Ok(()) => return,
      Err(err) => eprintln!("[studio] can't ask {label} about quitting: {err}"),
    }
  }
}

/// A page agrees to quit (its song is saved or discarded). Outside a quit (a page
/// calling it on its own), starts one, so no other window's edits are lost.
#[tauri::command]
pub fn quit(app: AppHandle, window: tauri::Window) {
  let state = app.state::<WindowsState>();
  let go_on = {
    let quit = state.quit.lock().unwrap();
    if !quit.active {
      None
    } else {
      // only the window that was asked moves things on
      Some(quit.asking.as_deref() == Some(window.label()))
    }
  };
  match go_on {
    None => request_quit(&app),
    Some(true) => ask_next(&app),
    Some(false) => {}
  }
}

/// A page chose Continue Editing: stop quitting.
#[tauri::command]
pub fn quit_cancel(state: State<WindowsState>) {
  *state.quit.lock().unwrap() = Quitting::default();
}

/// A window closed: forget its song, and if it was the one asked about quitting, go
/// on to the next. A song window's Edit window closes with it; an Edit window tells
/// its song window (which may have text still to draw). Once only Settings is left, close it too, so the app can end
/// (not on a Mac, where the app keeps running with no windows).
pub fn on_destroyed(app: &AppHandle, label: &str) {
  let state = app.state::<WindowsState>();
  state.songs.lock().unwrap().remove(label);
  if let Some(edit) = edit_label(label).and_then(|l| app.get_webview_window(&l)) {
    let _ = edit.close();
  }
  if let Some(song) = song_label(label) {
    let _ = app.emit_to(song.as_str(), EDIT_CLOSED_EVENT, ());
  }
  let was_asked = state.quit.lock().unwrap().asking.as_deref() == Some(label);
  if was_asked {
    ask_next(app);
  }
  let pages_left = app.webview_windows().keys().any(|l| l != label && is_page_window(l));
  if !pages_left && !cfg!(target_os = "macos") {
    if let Some(settings) = app.get_webview_window(crate::settings::SETTINGS_WINDOW) {
      let _ = settings.close();
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn a_song_window_and_its_edit_window_share_a_number() {
    assert_eq!(edit_label("song-3").as_deref(), Some("edit-3"));
    assert_eq!(song_label("edit-3").as_deref(), Some("song-3"));
    assert_eq!(edit_label("main"), None);
    assert_eq!(edit_label("edit-3"), None);
    assert_eq!(song_label("song-3"), None);
    assert_eq!(song_label("settings"), None);
  }

  #[test]
  fn an_edit_window_is_not_a_page_window() {
    assert!(is_page_window("main"));
    assert!(is_page_window("song-1"));
    assert!(!is_page_window("edit-1"));
  }
}
