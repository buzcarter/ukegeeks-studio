//! What each OS does its own way.

use std::process::Command;

/// Opens a web address in the default browser, or a folder in Finder (Explorer, the
/// file manager). Callers pass fixed addresses or folders of the Library, never text
/// straight from a page.
pub fn open(target: &str) -> std::io::Result<()> {
  let opener = if cfg!(target_os = "macos") {
    "open"
  } else if cfg!(target_os = "windows") {
    "explorer"
  } else {
    "xdg-open"
  };
  Command::new(opener).arg(target).spawn().map(|_| ())
}
