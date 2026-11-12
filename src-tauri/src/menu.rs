//! The app menu: its items, where each goes, and the Help pages.
//!
//! The menu's own items (New Song…, Open…, Save, Save As…, Print…) don't act here:
//! they send a `studio://menu` event with the item's id to the window in front, which
//! knows whether its song has unsaved changes (web/js/lib/menu.js). Add Songbook to
//! Library… and Show Song List go to the song list. Quit asks each song window in
//! turn (windows.rs). File > Open Recent is in recent.rs.

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::AppHandle;

use crate::{platform, recent, settings, windows};

const NEW_SONG: &str = "new-song";
const OPEN_FILE: &str = "open-file";
/// File > Add Songbook to Library… (the id is from when it was Open Songbook…)
const OPEN_SONGBOOK: &str = "open-songbook";
const SAVE: &str = "save";
const SAVE_AS: &str = "save-as";
const PRINT: &str = "print";
const QUIT: &str = "quit";
const SHOW_SONG_LIST: &str = "show-song-list";
// handled here: Settings opens its window, Help's items open a web page
const SETTINGS: &str = "settings";
const HELP: &str = "help";
const CHORDPRO_HELP: &str = "help-chordpro";

fn about_item(app: &AppHandle) -> tauri::Result<PredefinedMenuItem<tauri::Wry>> {
  let about = AboutMetadata {
    name: Some("UkeGeeks Studio".into()),
    copyright: Some("Copyright 2026 Buz Carter. GPL-3.0.".into()),
    website: Some("https://ukegeeks.org".into()),
    website_label: Some("ukegeeks.org".into()),
    ..Default::default()
  };
  PredefinedMenuItem::about(app, Some("About UkeGeeks Studio"), Some(about))
}

/// The menus, laid out as each OS expects (see docs/DECISIONS.md). On Windows there's
/// no app menu: About goes in Help and Quit is File > Exit. The editor keeps its own
/// controls; these are the app's.
pub fn build_menu(app: &AppHandle, open_recent: &Submenu<tauri::Wry>) -> tauri::Result<Menu<tauri::Wry>> {
  let sep = || PredefinedMenuItem::separator(app);
  // Not the predefined Quit: on a Mac that one ends the app at once (NSApp
  // terminate:), without asking about unsaved changes.
  let quit_label = if cfg!(target_os = "macos") { "Quit UkeGeeks Studio" } else { "Exit" };
  let quit = MenuItem::with_id(app, QUIT, quit_label, true, Some("CmdOrCtrl+Q"))?;
  let settings = MenuItem::with_id(app, SETTINGS, "Settings…", true, Some("CmdOrCtrl+,"))?;

  let file_menu = Submenu::with_items(
    app,
    "File",
    true,
    &[
      &MenuItem::with_id(app, NEW_SONG, "New Song…", true, Some("CmdOrCtrl+N"))?,
      &MenuItem::with_id(app, OPEN_FILE, "Open…", true, Some("CmdOrCtrl+O"))?,
      &MenuItem::with_id(app, OPEN_SONGBOOK, "Add Songbook to Library…", true, Some("CmdOrCtrl+Shift+O"))?,
      open_recent,
      &sep()?,
      &MenuItem::with_id(app, SAVE, "Save", true, Some("CmdOrCtrl+S"))?,
      &MenuItem::with_id(app, SAVE_AS, "Save As…", true, Some("CmdOrCtrl+Shift+S"))?,
      &sep()?,
      &MenuItem::with_id(app, PRINT, "Print…", true, Some("CmdOrCtrl+P"))?,
      &sep()?,
      // goes through the window's close request, so the editor asks about unsaved changes
      &PredefinedMenuItem::close_window(app, None)?,
    ],
  )?;
  #[cfg(not(target_os = "macos"))]
  {
    file_menu.append(&sep()?)?;
    file_menu.append(&settings)?;
    file_menu.append(&sep()?)?;
    file_menu.append(&quit)?;
  }

  // Without these, Cmd+Z/X/C/V/A stop working in the text boxes: on macOS the
  // shortcuts come from the Edit menu.
  let edit_menu = Submenu::with_items(
    app,
    "Edit",
    true,
    &[
      &PredefinedMenuItem::undo(app, None)?,
      &PredefinedMenuItem::redo(app, None)?,
      &sep()?,
      &PredefinedMenuItem::cut(app, None)?,
      &PredefinedMenuItem::copy(app, None)?,
      &PredefinedMenuItem::paste(app, None)?,
      &PredefinedMenuItem::select_all(app, None)?,
    ],
  )?;

  let view_menu = Submenu::with_items(
    app,
    "View",
    true,
    &[&MenuItem::with_id(app, SHOW_SONG_LIST, "Show Song List", true, Some("CmdOrCtrl+L"))?],
  )?;
  #[cfg(target_os = "macos")]
  {
    view_menu.append(&sep()?)?;
    view_menu.append(&PredefinedMenuItem::fullscreen(app, None)?)?;
  }

  let window_menu = Submenu::with_items(
    app,
    "Window",
    true,
    &[
      &PredefinedMenuItem::minimize(app, None)?,
      &PredefinedMenuItem::maximize(app, Some("Zoom"))?,
    ],
  )?;

  let help_menu = Submenu::with_items(
    app,
    "Help",
    true,
    &[
      &MenuItem::with_id(app, HELP, "UkeGeeks Studio Help", true, None::<&str>)?,
      &MenuItem::with_id(app, CHORDPRO_HELP, "ChordPro Reference", true, None::<&str>)?,
    ],
  )?;

  #[cfg(target_os = "macos")]
  {
    let app_menu = Submenu::with_items(
      app,
      "UkeGeeks Studio",
      true,
      &[
        &about_item(app)?,
        &sep()?,
        &settings,
        &sep()?,
        &PredefinedMenuItem::services(app, None)?,
        &sep()?,
        &PredefinedMenuItem::hide(app, None)?,
        &PredefinedMenuItem::hide_others(app, None)?,
        &PredefinedMenuItem::show_all(app, None)?,
        &sep()?,
        &quit,
      ],
    )?;
    // macOS names the Window and Help menus itself; it adds a search box to Help
    window_menu.set_as_windows_menu_for_nsapp()?;
    help_menu.set_as_help_menu_for_nsapp()?;
    Menu::with_items(app, &[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
  }
  #[cfg(not(target_os = "macos"))]
  {
    help_menu.append(&sep()?)?;
    help_menu.append(&about_item(app)?)?;
    Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &window_menu, &help_menu])
  }
}

/// Opens one of the Help pages in the default browser. The addresses are fixed
/// here, never taken from the page.
fn open_help(id: &str) {
  let url = match id {
    HELP => "https://ukegeeks.org",
    CHORDPRO_HELP => "https://www.chordpro.org/chordpro/chordpro-directives/",
    _ => return,
  };
  if let Err(err) = platform::open(url) {
    eprintln!("[studio] can't open {url}: {err}");
  }
}

/// A menu item was chosen: does it here, or sends it to the window it's for.
pub fn on_menu_event(app: &AppHandle, id: &str) {
  if recent::on_menu_event(app, id) {
    return;
  }
  match id {
    SETTINGS => settings::show_window(app),
    HELP | CHORDPRO_HELP => open_help(id),
    QUIT => windows::request_quit(app),
    SHOW_SONG_LIST => {
      windows::show_main(app, "");
    }
    // the song list shows the picker; opened afresh, it reads ?open=1
    OPEN_SONGBOOK => windows::send_to_main(app, "open=1", windows::MENU_EVENT, OPEN_SONGBOOK),
    NEW_SONG | OPEN_FILE | SAVE | SAVE_AS | PRINT => windows::send_menu(app, id),
    _ => {}
  }
}
