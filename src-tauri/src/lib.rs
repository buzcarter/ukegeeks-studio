//! UkeGeeks Studio. The app itself is web code in `web/`; Rust starts the window and
//! the plugins, and builds the app menu. File access goes through the fs plugin,
//! limited to the songbook folder the user picks with the dialog plugin (see
//! capabilities/).
//!
//! Each song opens in its own window (windows.rs). The menu's own items (New Song…,
//! Open…, Save, Save As…, Print…) don't act here: they send a `studio://menu` event
//! with the item's id to the window in front, which knows whether its song has
//! unsaved changes (web/js/menu.js). Add Songbook to Library… and Show Song List go
//! to the song list, whose sidebar is the Library (library.rs). Quit asks each song window in turn (windows.rs). File > Open Recent is in
//! recent.rs; Favorites (starred songs) in favorites.rs.

mod favorites;
mod library;
mod recent;
mod settings;
mod windows;

use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

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
fn build_menu(app: &AppHandle, open_recent: &Submenu<tauri::Wry>) -> tauri::Result<Menu<tauri::Wry>> {
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

/// Asks each song window about unsaved changes, then ends the app (windows.rs).
fn request_quit(app: &AppHandle) {
  windows::request_quit(app);
}

/// Ends the app, once every song window agreed.
pub(crate) fn exit_app(app: &AppHandle) {
  #[cfg(target_os = "macos")]
  dock_quit::allow();
  app.exit(0);
}

/// Saves a song opened on its own (File > Open…) or saved somewhere new (Save As…):
/// a temp file next to it, then a rename, like the pages' Save in a songbook. Only
/// for a file the app was given (the Open or Save dialog, or File > Open Recent).
/// Rust writes the temp file because the app has no access to the file's folder.
#[tauri::command]
fn save_song_file(app: AppHandle, path: String, text: String) -> Result<(), String> {
  use tauri_plugin_fs::FsExt;
  let target = std::path::PathBuf::from(&path);
  let name = target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
  if !target.is_absolute() || name.is_empty() || !app.fs_scope().is_allowed(&target) {
    return Err(format!("not a file the app may write: {path}"));
  }
  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.subsec_nanos())
    .unwrap_or(0);
  // not a dotfile, as in SongRepository.update; ".ugs-tmp" is never listed as a song
  let tmp = target.with_file_name(format!("{name}.{:x}{:x}.ugs-tmp", std::process::id(), stamp));
  let result = std::fs::OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(&tmp)
    .and_then(|mut file| std::io::Write::write_all(&mut file, text.as_bytes()))
    .and_then(|_| std::fs::rename(&tmp, &target));
  if let Err(err) = result {
    let _ = std::fs::remove_file(&tmp);
    return Err(format!("can't save {path}: {err}"));
  }
  Ok(())
}

/// File > Print…: the system Print dialog for this page, as a sheet on its window,
/// with half-inch margins. (Tauri's own print sets the margins to zero, and printers
/// clip what's at the paper's edge.) The paper size and other choices in the dialog
/// carry over to the next print. Only on a Mac; elsewhere the page uses window.print().
#[tauri::command]
fn print_page(webview: tauri::Webview) -> Result<(), String> {
  #[cfg(target_os = "macos")]
  {
    webview
      .with_webview(|platform| unsafe { mac_print::run(platform.inner().cast()) })
      .map_err(|err| err.to_string())
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = webview;
    Err("use window.print()".into())
  }
}

#[cfg(target_os = "macos")]
mod mac_print {
  use objc2::msg_send;
  use objc2::runtime::{AnyClass, AnyObject, Sel};

  /// Half an inch, in points
  const MARGIN: f64 = 36.0;
  /// NSPrintingPaginationMode.fit: wide songs shrink to the page width
  const FIT: isize = 1;

  pub unsafe fn run(wk_webview: *mut AnyObject) {
    let Some(print_info_class) = AnyClass::get(c"NSPrintInfo") else { return };
    let info: *mut AnyObject = msg_send![print_info_class, sharedPrintInfo];
    let _: () = msg_send![info, setTopMargin: MARGIN];
    let _: () = msg_send![info, setBottomMargin: MARGIN];
    let _: () = msg_send![info, setLeftMargin: MARGIN];
    let _: () = msg_send![info, setRightMargin: MARGIN];
    let _: () = msg_send![info, setHorizontalPagination: FIT];
    // WKWebView's own print operation (macOS 11+), as wry does
    let operation: *mut AnyObject = msg_send![wk_webview, printOperationWithPrintInfo: info];
    let window: *mut AnyObject = msg_send![wk_webview, window];
    if operation.is_null() || window.is_null() {
      eprintln!("[studio] can't print: no print operation or window");
      return;
    }
    let _: () = msg_send![
      operation,
      runOperationModalForWindow: window,
      delegate: std::ptr::null_mut::<AnyObject>(),
      didRunSelector: None::<Sel>,
      contextInfo: std::ptr::null_mut::<std::ffi::c_void>()
    ];
  }
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
      if id == SETTINGS {
        settings::show_window(app);
      } else if [HELP, CHORDPRO_HELP].contains(&id) {
        open_help(id);
      } else if id == QUIT {
        request_quit(app);
      } else if id == SHOW_SONG_LIST {
        windows::show_main(app, "");
      } else if id == OPEN_SONGBOOK {
        // the song list shows the picker; opened afresh, it reads ?open=1
        windows::send_to_main(app, "open=1", windows::MENU_EVENT, OPEN_SONGBOOK);
      } else if [NEW_SONG, OPEN_FILE, SAVE, SAVE_AS, PRINT].contains(&id) {
        windows::send_menu(app, id);
      }
    })
    .invoke_handler(tauri::generate_handler![
      windows::quit,
      windows::quit_cancel,
      windows::open_song_window,
      windows::song_window_path,
      save_song_file,
      print_page,
      recent::recent_list,
      library::library_get,
      library::library_add,
      library::library_rename,
      library::library_remove,
      library::library_select,
      favorites::favorites_get,
      favorites::favorites_star,
      favorites::favorites_rename,
      recent::recent_add_song,
      settings::settings_get,
      settings::settings_set,
    ])
    .on_window_event(|window, event| {
      if matches!(event, WindowEvent::Destroyed) {
        windows::on_destroyed(window.app_handle(), window.label());
      }
    })
    .setup(|app| {
      let handle = app.handle();
      let recent = recent::load(handle);
      let old_songbooks = recent::take_songbooks(handle, &recent);
      app.manage(library::load(handle, &old_songbooks));
      app.manage(favorites::load(handle));
      let open_recent = recent::build_submenu(handle, &recent)?;
      app.manage(recent);
      app.manage(settings::load(handle));
      app.manage(windows::WindowsState::default());
      app.set_menu(build_menu(handle, &open_recent)?)?;
      #[cfg(target_os = "macos")]
      dock_quit::install(app.handle().clone());
      #[cfg(not(target_os = "macos"))]
      let _ = app;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building UkeGeeks Studio");

  app.run(|app, event| match event {
    // In Tauri 2.12 a request with no exit code comes only from the last window
    // closing. On a Mac the app stays running then, as Mac apps do (Quit ends it);
    // elsewhere it ends. Should another path ever send one while a window is open,
    // ask the song windows first, as for Quit.
    RunEvent::ExitRequested { code: None, api, .. } => {
      if !app.webview_windows().is_empty() {
        api.prevent_exit();
        request_quit(app);
      } else if cfg!(target_os = "macos") {
        api.prevent_exit();
      }
    }
    // Clicking the Dock icon with no windows showing brings back the Library
    #[cfg(target_os = "macos")]
    RunEvent::Reopen { has_visible_windows: false, .. } => {
      windows::show_main(app, "");
    }
    _ => {}
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
