//! UkeGeeks Studio. The app itself is web code in `web/`; Rust only starts the
//! window and the plugins. File access goes through the fs plugin, limited to the
//! songbook folder the user picks with the dialog plugin (see capabilities/).

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .run(tauri::generate_context!())
    .expect("error while running UkeGeeks Studio");
}
