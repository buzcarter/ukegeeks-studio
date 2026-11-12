//! File > Print…

/// File > Print…: the system Print dialog for this page, as a sheet on its window,
/// with half-inch margins. (Tauri's own print sets the margins to zero, and printers
/// clip what's at the paper's edge.) The paper size and other choices in the dialog
/// carry over to the next print. Only on a Mac; elsewhere the page uses window.print().
#[tauri::command]
pub fn print_page(webview: tauri::Webview) -> Result<(), String> {
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
