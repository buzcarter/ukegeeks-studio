//! UkeGeeks Studio. The app itself is web code in `web/`; Rust starts the windows and
//! the plugins, builds the app menu (menu.rs), and keeps the app's own files
//! (store.rs). File access goes through the fs plugin, limited to the songbook
//! folders the user picks with the dialog plugin (see capabilities/).
//!
//! Each song opens in its own window (windows.rs). The song list's sidebar is the
//! Library (library.rs); Favorites (starred songs) are in favorites.rs, File > Open
//! Recent in recent.rs, the Settings window in settings.rs. Songs opened from Finder,
//! Explorer or the command line go through open_files.rs.

#[cfg(target_os = "macos")]
mod dock_quit;
mod favorites;
mod library;
mod menu;
mod open_files;
mod paths;
mod platform;
mod print;
mod recent;
mod settings;
mod song_file;
mod store;
mod windows;

use tauri::{AppHandle, Manager, RunEvent, WindowEvent};

/// Ends the app, once every song window agreed.
pub(crate) fn exit_app(app: &AppHandle) {
  #[cfg(target_os = "macos")]
  dock_quit::allow();
  app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = tauri::Builder::default();
  // Windows and Linux start a second copy of the app for a double-clicked song: it
  // hands its command line to this one and quits. (A Mac sends RunEvent::Opened.)
  // The plugin must be the first one registered.
  #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
  let builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
    let paths = open_files::paths_from_args(argv.into_iter().skip(1), std::path::Path::new(&cwd));
    if paths.is_empty() {
      windows::show_main(app, "");
    } else {
      open_files::open_paths(app, paths);
    }
  }));
  let app = builder
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .on_menu_event(|app, event| menu::on_menu_event(app, event.id().as_ref()))
    .invoke_handler(tauri::generate_handler![
      windows::quit,
      windows::quit_cancel,
      windows::open_song_window,
      windows::open_edit_window,
      windows::show_songbook,
      windows::song_window_path,
      song_file::save_song_file,
      print::print_page,
      recent::recent_list,
      library::library_get,
      library::library_add,
      library::library_rename,
      library::library_remove,
      library::library_select,
      library::library_change_folder,
      library::library_reveal,
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
      app.set_menu(menu::build_menu(handle, &open_recent)?)?;
      #[cfg(target_os = "macos")]
      dock_quit::install(app.handle().clone());
      // a song double-clicked on Windows or Linux starts the app with its path
      #[cfg(not(any(target_os = "macos", target_os = "ios", target_os = "android")))]
      {
        let cwd = std::env::current_dir().unwrap_or_default();
        open_files::open_paths(handle, open_files::paths_from_args(std::env::args().skip(1), &cwd));
      }
      // songs a Mac sent before the app had started (RunEvent::Opened, below)
      open_files::open_waiting(handle);
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
        windows::request_quit(app);
      } else if cfg!(target_os = "macos") {
        api.prevent_exit();
      }
    }
    // Clicking the Dock icon with no windows showing brings back the Library
    // A song double-clicked in Finder, opened with Open With, or dropped on the Dock
    // icon, whether or not the app was running
    #[cfg(target_os = "macos")]
    RunEvent::Opened { urls } => {
      let paths = urls.into_iter().filter_map(|url| url.to_file_path().ok()).collect();
      open_files::open_paths(app, paths);
    }
    #[cfg(target_os = "macos")]
    RunEvent::Reopen { has_visible_windows: false, .. } => {
      windows::show_main(app, "");
    }
    _ => {}
  });
}
