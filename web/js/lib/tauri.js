/**
 * The way to Tauri from the pages. `app.withGlobalTauri` (src-tauri/tauri.conf.json)
 * puts window.__TAURI__ on every page: { core, dialog, fs, window, event }. There's
 * no bundler, so the pages use that rather than importing @tauri-apps/api.
 */

export function tauri() {
  if (!window.__TAURI__) {
    throw new Error('These pages need the UkeGeeks Studio app (npm run dev); a browser has no file access.');
  }
  return window.__TAURI__;
}

/** Calls one of the app's own Rust commands (src-tauri/src/*.rs). */
export function invoke(command, args) {
  return tauri().core.invoke(command, args);
}

/** What went wrong, as text. Tauri rejects with plain strings; the pages' own code with Errors. */
export function errorMessage(err) {
  return err && err.message ? err.message : String(err);
}

/** Runs callback(payload) whenever Rust (or a page) sends the event, to any window. */
export function onEvent(name, callback) {
  tauri().event.listen(name, (event) => callback(event.payload))
    .catch((err) => console.error(`[studio] ${name} events:`, err));
}

/** An error box: "There was a problem… (the reason)". */
export function showProblem(title, message, err) {
  return tauri().dialog.message(err === undefined ? message : `${message} (${errorMessage(err)})`, { title, kind: 'error' });
}
