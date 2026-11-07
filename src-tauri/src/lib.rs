//! UkeGeeks Studio. The app itself is web code in `web/`; Rust starts the window and
//! the plugins, and builds the app menu. File access goes through the fs plugin,
//! limited to the songbook folder the user picks with the dialog plugin (see
//! capabilities/).
//!
//! The menu's own items (Open Songbook…, Save, Save As…, Show Song List, Quit) don't act here: they
//! send a `studio://menu` event with the item's id to the page, which knows whether
//! the song has unsaved changes (web/js/menu.js). Quitting goes through the page
//! too, which then calls the `quit` command. File > Open Recent is in recent.rs.

mod recent;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager, RunEvent};

/// The event the pages listen for; the payload is the menu item's id.
const MENU_EVENT: &str = "studio://menu";

const OPEN_SONGBOOK: &str = "open-songbook";
const SAVE: &str = "save";
const SAVE_AS: &str = "save-as";
const QUIT: &str = "quit";
const SHOW_SONG_LIST: &str = "show-song-list";
// handled here: they open a web page
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
fn build_menu(app: &AppHandle, open_recent: &Submenu<tauri::Wry>) -> tauri::Result<Menu<tauri::Wry>> {
  let sep = || PredefinedMenuItem::separator(app);
  // Not the predefined Quit: on a Mac that one ends the app at once (NSApp
  // terminate:), without asking about unsaved changes.
  let quit_label = if cfg!(target_os = "macos") { "Quit UkeGeeks Studio" } else { "Exit" };
  let quit = MenuItem::with_id(app, QUIT, quit_label, true, Some("CmdOrCtrl+Q"))?;

  let file_menu = Submenu::with_items(
    app,
    "File",
    true,
    &[
      &MenuItem::with_id(app, OPEN_SONGBOOK, "Open Songbook…", true, Some("CmdOrCtrl+O"))?,
      open_recent,
      &sep()?,
      &MenuItem::with_id(app, SAVE, "Save", true, Some("CmdOrCtrl+S"))?,
      &MenuItem::with_id(app, SAVE_AS, "Save As…", true, Some("CmdOrCtrl+Shift+S"))?,
      &sep()?,
      // goes through the window's close request, so the editor asks about unsaved changes
      &PredefinedMenuItem::close_window(app, None)?,
    ],
  )?;
  #[cfg(not(target_os = "macos"))]
  {
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
  #[cfg(target_os = "macos")]
  let result = std::process::Command::new("open").arg(url).spawn();
  #[cfg(target_os = "windows")]
  let result = std::process::Command::new("explorer").arg(url).spawn();
  #[cfg(not(any(target_os = "macos", target_os = "windows")))]
  let result = std::process::Command::new("xdg-open").arg(url).spawn();
  if let Err(err) = result {
    eprintln!("[studio] can't open {url}: {err}");
  }
}

/// Asks the page to quit: it checks for unsaved changes, then calls `quit`.
fn request_quit(app: &AppHandle) {
  if let Err(err) = app.emit(MENU_EVENT, QUIT) {
    eprintln!("[studio] can't send quit to the page: {err}");
    app.exit(0);
  }
}

/// Ends the app. The pages call this once unsaved changes are saved or discarded.
#[tauri::command]
fn quit(app: AppHandle) {
  #[cfg(target_os = "macos")]
  dock_quit::allow();
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let app = tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .on_menu_event(|app, event| {
      let id = event.id().as_ref();
      if recent::on_menu_event(app, id) {
        return;
      }
      if [HELP, CHORDPRO_HELP].contains(&id) {
        open_help(id);
      } else if [OPEN_SONGBOOK, SAVE, SAVE_AS, SHOW_SONG_LIST, QUIT].contains(&id) {
        if let Err(err) = app.emit(MENU_EVENT, id) {
          eprintln!("[studio] can't send menu item {id} to the page: {err}");
        }
      }
    })
    .invoke_handler(tauri::generate_handler![
      quit,
      recent::recent_list,
      recent::recent_add_songbook,
      recent::recent_add_song,
    ])
    .setup(|app| {
      let handle = app.handle();
      let recent = recent::load(handle);
      let open_recent = recent::build_submenu(handle, &recent)?;
      app.manage(recent);
      app.set_menu(build_menu(handle, &open_recent)?)?;
      #[cfg(target_os = "macos")]
      dock_quit::install(app.handle().clone());
      #[cfg(not(target_os = "macos"))]
      let _ = app;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building UkeGeeks Studio");

  app.run(|app, event| {
    // In Tauri 2.12 a request with no exit code comes only from the last window
    // closing, and then the app should end. Should another path ever send one while
    // a window is open, ask the page first, as for Quit.
    if let RunEvent::ExitRequested { code: None, api, .. } = event {
      if !app.webview_windows().is_empty() {
        api.prevent_exit();
        request_quit(app);
      }
    }
  });
}

/// Quit from the Dock (and from logging out) sends NSApp `terminate:`, which Tauri
/// 2.12 doesn't pass on as an event: the app just ends. Adding
/// `applicationShouldTerminate:` to tao's app delegate lets the page ask about
/// unsaved changes first. The app's own Quit item (Cmd+Q) doesn't come through here.
#[cfg(target_os = "macos")]
mod dock_quit {
  use objc2::ffi::{class_addMethod, object_getClass};
  use objc2::runtime::{AnyClass, AnyObject, Imp, Sel};
  use objc2::{msg_send, sel};
  use std::sync::atomic::{AtomicBool, Ordering};
  use std::sync::OnceLock;
  use tauri::AppHandle;

  static APP: OnceLock<AppHandle> = OnceLock::new();
  /// Set once the page agreed to quit: the next `terminate:` goes through.
  static QUITTING: AtomicBool = AtomicBool::new(false);

  const NS_TERMINATE_CANCEL: usize = 0;
  const NS_TERMINATE_NOW: usize = 1;

  pub fn allow() {
    QUITTING.store(true, Ordering::SeqCst);
  }

  extern "C-unwind" fn should_terminate(_this: *mut AnyObject, _cmd: Sel, _sender: *mut AnyObject) -> usize {
    if QUITTING.load(Ordering::SeqCst) {
      return NS_TERMINATE_NOW;
    }
    match APP.get() {
      Some(app) => {
        super::request_quit(app);
        NS_TERMINATE_CANCEL
      }
      None => NS_TERMINATE_NOW,
    }
  }

  pub fn install(app: AppHandle) {
    let _ = APP.set(app);
    unsafe {
      let ns_app: *mut AnyObject = msg_send![AnyClass::get(c"NSApplication").unwrap(), sharedApplication];
      let delegate: *mut AnyObject = msg_send![ns_app, delegate];
      if delegate.is_null() {
        eprintln!("[studio] no app delegate: Quit from the Dock won't ask about unsaved changes");
        return;
      }
      let imp: Imp = std::mem::transmute(
        should_terminate as extern "C-unwind" fn(*mut AnyObject, Sel, *mut AnyObject) -> usize,
      );
      // returns NSUInteger (Q); takes self (@), _cmd (:), sender (@)
      let added = class_addMethod(
        object_getClass(delegate) as *mut AnyClass,
        sel!(applicationShouldTerminate:),
        imp,
        c"Q@:@".as_ptr(),
      );
      if !added.as_bool() {
        eprintln!("[studio] the app delegate already has applicationShouldTerminate:; Quit from the Dock won't ask");
      }
    }
  }
}
