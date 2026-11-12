//! The app's own files: small JSON files in the app's config folder
//! (~/Library/Application Support/org.ukegeeks.studio/ on a Mac): library.json,
//! favorites.json, recent.json and settings.json.
//!
//! - **Writing** goes to a temp file first, then a rename, so a crash or a full disk
//!   never leaves half a file.
//! - **Reading** a file that isn't valid JSON (a hand edit gone wrong, say) sets it
//!   aside as `<name>.unreadable.json` rather than letting the next save replace it:
//!   the app starts with nothing for that file, and the player's data is still there
//!   to mend.

use serde::de::DeserializeOwned;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

fn file_path(app: &AppHandle, name: &str) -> Option<PathBuf> {
  app.path().app_config_dir().ok().map(|dir| dir.join(name))
}

/// Reads one of the app's files. None if it's missing or can't be read.
pub fn read<T: DeserializeOwned>(app: &AppHandle, name: &str) -> Option<T> {
  read_file(&file_path(app, name)?)
}

/// Writes one of the app's files.
pub fn write<T: Serialize>(app: &AppHandle, name: &str, value: &T) -> Result<(), String> {
  let path = file_path(app, name).ok_or("no config folder")?;
  write_file(&path, value).map_err(|err| format!("can't save {}: {err}", path.display()))
}

/// Writes one of the app's files; a failure is only logged. For changes the pages
/// don't wait on (a star, the selected songbook), which stay in memory for this run.
pub fn write_or_log<T: Serialize>(app: &AppHandle, name: &str, value: &T) {
  if let Err(err) = write(app, name, value) {
    eprintln!("[studio] {err}");
  }
}

fn read_file<T: DeserializeOwned>(path: &Path) -> Option<T> {
  let text = std::fs::read_to_string(path).ok()?;
  match serde_json::from_str(&text) {
    Ok(value) => Some(value),
    Err(err) => {
      let aside = path.with_extension("unreadable.json");
      eprintln!("[studio] can't read {} ({err}); kept as {}", path.display(), aside.display());
      if let Err(err) = std::fs::rename(path, &aside) {
        eprintln!("[studio] can't set {} aside: {err}", path.display());
      }
      None
    }
  }
}

fn write_file<T: Serialize>(path: &Path, value: &T) -> std::io::Result<()> {
  let text = serde_json::to_string_pretty(value)?;
  if let Some(dir) = path.parent() {
    std::fs::create_dir_all(dir)?;
  }
  let tmp = path.with_extension(format!("{}.tmp", std::process::id()));
  let result = std::fs::write(&tmp, text).and_then(|_| std::fs::rename(&tmp, path));
  if result.is_err() {
    let _ = std::fs::remove_file(&tmp);
  }
  result
}

#[cfg(test)]
mod tests {
  use super::*;

  /// An empty folder of this test's own, under the system temp folder.
  fn temp_dir(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("ukegeeks-studio-store-{}-{name}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    dir
  }

  fn names(dir: &Path) -> Vec<String> {
    let mut names: Vec<String> =
      std::fs::read_dir(dir).unwrap().map(|e| e.unwrap().file_name().to_string_lossy().into_owned()).collect();
    names.sort();
    names
  }

  #[test]
  fn writes_then_reads_and_leaves_no_temp_file() {
    let dir = temp_dir("roundtrip");
    let path = dir.join("list.json");
    write_file(&path, &vec!["a", "b"]).unwrap();
    write_file(&path, &vec!["c"]).unwrap();
    assert_eq!(read_file::<Vec<String>>(&path), Some(vec!["c".to_string()]));
    assert_eq!(names(&dir), ["list.json"]);
    std::fs::remove_dir_all(&dir).unwrap();
  }

  #[test]
  fn a_missing_file_reads_as_none() {
    assert_eq!(read_file::<Vec<String>>(&temp_dir("missing").join("list.json")), None);
  }

  #[test]
  fn an_unreadable_file_is_set_aside_not_lost() {
    let dir = temp_dir("unreadable");
    let path = dir.join("list.json");
    std::fs::create_dir_all(&dir).unwrap();
    std::fs::write(&path, "[\"a\", oops").unwrap();
    assert_eq!(read_file::<Vec<String>>(&path), None);
    assert_eq!(names(&dir), ["list.unreadable.json"]);
    assert_eq!(std::fs::read_to_string(dir.join("list.unreadable.json")).unwrap(), "[\"a\", oops");
    std::fs::remove_dir_all(&dir).unwrap();
  }
}
