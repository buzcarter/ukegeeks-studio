//! Comparing and naming paths, as the app's own files keep them (strings).

use std::path::Path;

/// The same file or folder? Trailing slashes aside, and ignoring case, as Mac and
/// Windows names do.
pub fn same_path(a: &str, b: &str) -> bool {
  let clean = |p: &str| p.trim_end_matches(['/', '\\']).to_lowercase();
  clean(a) == clean(b)
}

/// The folder's last part ("cpm" for ".../UkeGeeks/cpm").
pub fn folder_name(folder: &str) -> String {
  Path::new(folder)
    .file_name()
    .map(|name| name.to_string_lossy().into_owned())
    .unwrap_or_else(|| folder.to_string())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn paths_compare_without_case_or_trailing_slashes() {
    assert!(same_path("/a/Songs/", "/a/songs"));
    assert!(same_path("C:\\Songs\\", "c:\\songs"));
    assert!(!same_path("/a/songs", "/a/songs2"));
  }

  #[test]
  fn a_folder_is_named_by_its_last_part() {
    assert_eq!(folder_name("/Users/me/UkeGeeks/cpm"), "cpm");
    assert_eq!(folder_name("/Users/me/UkeGeeks/cpm/"), "cpm");
    assert_eq!(folder_name("/"), "/");
  }
}
