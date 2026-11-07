/**
 * The app menu's own items (built in src-tauri/src/lib.rs) arrive as a
 * "studio://menu" event with the item's id, sent to one window only
 * (src-tauri/src/windows.rs): "new-song", "open-file", "save", "save-as", "print" to
 * the window in front; "open-songbook" to the song list; "quit" to each song window in
 * turn. (Settings…, Help's items and Show Song List are handled in Rust.) A recent
 * songbook arrives at the song list as "studio://open-recent" with { folder },
 * handled as "open-recent"; a recent song opens in its own window. Each page says
 * what to do with onMenu(); items a page doesn't handle do nothing, except Quit,
 * which says yes.
 *
 * The listener starts as soon as this module loads, so Quit works even on a page
 * that failed to open its song.
 */
const MENU_EVENT = 'studio://menu';
const OPEN_RECENT_EVENT = 'studio://open-recent';

const handlers = new Map();

/**
 * Says yes to Quit for this window (the Rust `quit` command): Rust asks the next song
 * window, and ends the app after the last.
 */
export function quitApp() {
  return window.__TAURI__.core.invoke('quit');
}

/** Says no to Quit (Continue Editing): nothing closes. */
export function cancelQuit() {
  return window.__TAURI__.core.invoke('quit_cancel');
}

/** Runs handler(detail) when the menu item with this id is chosen; replaces any earlier one. */
export function onMenu(id, handler) {
  handlers.set(id, handler);
}

let busy = false;

async function handle(id, detail) {
  // one at a time: pressing Cmd+Q twice shouldn't stack two "Unsaved changes" questions
  if (busy) return;
  busy = true;
  try {
    const handler = handlers.get(id) || (id === 'quit' ? quitApp : null);
    if (handler) await handler(detail);
  } catch (err) {
    console.error(`[studio] menu item ${id}:`, err);
  } finally {
    busy = false;
  }
}

if (window.__TAURI__) {
  const { listen } = window.__TAURI__.event;
  // Only events sent to this window: a plain listen() also hears the ones sent to
  // the others, and then every song window would save.
  const target = { kind: 'AnyLabel', label: window.__TAURI__.window.getCurrentWindow().label };
  listen(MENU_EVENT, (event) => handle(event.payload), { target })
    .catch((err) => console.error('[studio] menu events:', err));
  listen(OPEN_RECENT_EVENT, (event) => handle('open-recent', event.payload), { target })
    .catch((err) => console.error('[studio] Open Recent events:', err));
}
