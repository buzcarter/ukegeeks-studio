//! Saving a song that isn't in a songbook folder the app may write to.

use tauri::AppHandle;

/// Saves a song opened on its own (File > Open…) or saved somewhere new (Save As…):
/// a temp file next to it, then a rename, like the pages' Save in a songbook. Only
/// for a file the app was given (the Open or Save dialog, or File > Open Recent).
/// Rust writes the temp file because the app has no access to the file's folder.
#[tauri::command]
pub fn save_song_file(app: AppHandle, path: String, text: String) -> Result<(), String> {
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
