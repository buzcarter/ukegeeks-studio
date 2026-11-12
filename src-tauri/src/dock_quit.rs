//! Quit from the Dock (and from logging out) sends NSApp `terminate:`, which Tauri
//! 2.12 doesn't pass on as an event: the app just ends. Adding
//! `applicationShouldTerminate:` to tao's app delegate lets the page ask about
//! unsaved changes first. The app's own Quit item (Cmd+Q) doesn't come through here.

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
      crate::windows::request_quit(app);
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
