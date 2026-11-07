/**
 * The app menu's own items (built in src-tauri/src/lib.rs) arrive as a
 * "studio://menu" event with the item's id: "new-song", "open-file",
 * "open-songbook", "save", "save-as", "print", "show-song-list", "quit". (Settings…
 * and Help's items are handled in Rust.) File > Open Recent's items arrive as
 * "studio://open-recent" with { folder, song, single }, handled as "open-recent".
 * Each page says what to do with onMenu(); items a page doesn't handle do nothing,
 * except Quit, which quits.
 *
 * The listener starts as soon as this module loads, so Quit works even on a page
 * that failed to open its song.
 */
const MENU_EVENT = 'studio://menu';
const OPEN_RECENT_EVENT = 'studio://open-recent';

const handlers = new Map();

/** Ends the app (the Rust `quit` command), without asking. */
export function quitApp() {
  return window.__TAURI__.core.invoke('quit');
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
  listen(MENU_EVENT, (event) => handle(event.payload))
    .catch((err) => console.error('[studio] menu events:', err));
  listen(OPEN_RECENT_EVENT, (event) => handle('open-recent', event.payload))
    .catch((err) => console.error('[studio] Open Recent events:', err));
}
