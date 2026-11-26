/**
 * A song window (editor.html, "song-N") and its Edit window (edit-window.html,
 * "edit-N": the Ace editor in a window of its own, opened by the toolbar's Edit
 * button) talk through these events, each sent to the other's window only:
 *
 *   edit → song  READY   the Edit window has loaded: send the song
 *   song → edit  SONG    { text?, title? }: the song's text (when it opens, and when the
 *                        song window changes it: Transpose, the Chord Builder, Reformat);
 *                        the window title
 *   edit → song  TYPED   { text, mid }: the text as typed; `mid` while the cursor is
 *                        mid-command (lib/mid-command.js), when the songsheet isn't redrawn
 *   Rust → song  CLOSED  the Edit window closed (src-tauri/src/windows.rs)
 *
 * The song window owns the song: its text, "Edited", Save. The Edit window only types.
 */
import { tauri } from './tauri.js';

export const EDIT_EVENTS = {
  READY: 'studio://edit-ready',
  SONG: 'studio://edit-song',
  TYPED: 'studio://edit-typed',
  CLOSED: 'studio://edit-closed',
};

const SONG_PREFIX = 'song-';
const EDIT_PREFIX = 'edit-';

/** This window's label: "main", "song-N", "edit-N" */
export function windowLabel() {
  return tauri().window.getCurrentWindow().label;
}

/** The other window of the pair: a song window's Edit window, an Edit window's song window. */
export function partnerLabel(label = windowLabel()) {
  if (label.startsWith(SONG_PREFIX)) return EDIT_PREFIX + label.slice(SONG_PREFIX.length);
  if (label.startsWith(EDIT_PREFIX)) return SONG_PREFIX + label.slice(EDIT_PREFIX.length);
  return null;
}

/** Sends an event to the other window of the pair (nothing happens if it isn't open). */
export function sendToPartner(name, payload) {
  const label = partnerLabel();
  if (!label) return Promise.resolve();
  return tauri().event.emitTo(label, name, payload)
    .catch((err) => console.warn(`[studio] ${name} to ${label}:`, err));
}

/**
 * Runs callback(payload) for events sent to this window. (A plain listen() also hears
 * the ones sent to other windows: every song window would take every Edit window's text.)
 */
export function onWindowEvent(name, callback) {
  const target = { kind: 'AnyLabel', label: windowLabel() };
  tauri().event.listen(name, (event) => callback(event.payload || {}), { target })
    .catch((err) => console.error(`[studio] ${name} events:`, err));
}
