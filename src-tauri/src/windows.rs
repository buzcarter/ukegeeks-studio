//! The app's windows: `main` (the song list) and one window per open song
//! (`song-1`, `song-2`, …), plus Settings (settings.rs).
//!
//! - **Opening a song** (`open_song_window`) opens a window for it, or brings its
//!   window forward if it's already open. Each song window tells Rust which file it
//!   holds (`song_window_path`), since Save As and renames change it.
//! - **Menu items** go to the window in front (`send_menu`), not to every window: a
//!   page's plain `listen` hears events sent to any window, so the pages listen for
//!   events sent to their own label (web/js/menu.js).
//! - **Quit** asks each song window in turn about unsaved changes (`request_quit`):
//!   the window answers with `quit` (go on) or `quit_cancel` (stop quitting). When
//!   every song window has said yes, the app ends.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const MAIN_WINDOW: &str = "main";
const SONG_PREFIX: &str = "song-";

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

/// The song list or a song window (not Settings)
fn is_page_window(label: &str) -> bool {
  label == MAIN_WINDOW || is_song_window(label)
}

/// The same file? Trailing slashes aside, and ignoring case, as Mac and Windows file
/// names do.
fn same_path(a: &str, b: &str) -> bool {
  let clean = |p: &str| p.trim_end_matches(['/', '\\']).to_lowercase();
  clean(a) == clean(b)
}

/// The song list or song window in front, if any
fn focused_page_window(app: &AppHandle) -> Option<WebviewWindow> {
  app
    .webview_windows()
    .into_values()
    .find(|w| is_page_window(w.label()) && w.is_focused().unwrap_or(false))
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

/// Sends a menu item to the window in front; if that's Settings or nothing, to the
/// song list, or failing that, to a song window. (Save, Save As and Print mean
/// something only in a song window; the song list ignores them.)
pub fn send_menu(app: &AppHandle, id: &str) {
  let target = focused_page_window(app)
    .or_else(|| app.get_webview_window(MAIN_WINDOW))
    .or_else(|| app.webview_windows().into_values().find(|w| is_song_window(w.label())));
  match target {
    Some(window) => {
      if let Err(err) = app.emit_to(window.label(), MENU_EVENT, id) {
        eprintln!("[studio] can't send menu item {id} to {}: {err}", window.label());
      }
    }
    // no windows but Settings: the item needs a page, so open the song list
    None => {
      show_main(app, "");
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
/// on to the next. Once only Settings is left, close it too, so the app can end.
pub fn on_destroyed(app: &AppHandle, label: &str) {
  let state = app.state::<WindowsState>();
  state.songs.lock().unwrap().remove(label);
  let was_asked = state.quit.lock().unwrap().asking.as_deref() == Some(label);
  if was_asked {
    ask_next(app);
  }
  let pages_left = app.webview_windows().keys().any(|l| l != label && is_page_window(l));
  if !pages_left {
    if let Some(settings) = app.get_webview_window(crate::settings::SETTINGS_WINDOW) {
      let _ = settings.close();
    }
  }
}
