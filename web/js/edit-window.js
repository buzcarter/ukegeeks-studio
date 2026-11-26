/**
 * The Edit window: a song's ChordPro text in the Ace editor, in a window of its own
 * beside the song's (the toolbar's Edit button opens it: src-tauri/src/windows.rs,
 * open_edit_window). The songsheet in the song window follows as you type, except
 * while you're mid-command (lib/mid-command.js): after an opening `[` or `{`, it waits
 * until the cursor is out of the brackets.
 *
 * The song window owns the song (lib/edit-window.js has the events). File > Save,
 * Save As… and Print… chosen here go to it (windows.rs, send_menu); closing this
 * window loses nothing.
 */
import { EDIT_EVENTS, onWindowEvent, sendToPartner } from './lib/edit-window.js';
import { isMidCommand } from './lib/mid-command.js';
import { errorMessage, tauri } from './lib/tauri.js';

/** Typing is sent on once it pauses this long (ms), so fast typing redraws the songsheet once */
const TYPING_PAUSE = 150;

function showProblem(message) {
  const problem = document.getElementById('editProblem');
  problem.textContent = message;
  problem.hidden = false;
  document.getElementById('songSource').hidden = true;
}

function main() {
  const editor = ace.edit('songSource');
  editor.setTheme('ace/theme/idle_fingers');
  editor.session.setMode('ace/mode/chordpro');
  editor.setOptions({ enableBasicAutocompletion: true, enableSnippets: true });
  editor.setShowPrintMargin(false);
  editor.setFontSize(14);

  // what the song window has: the text, and whether it's waiting to redraw
  let sentText = null;
  let sentMid = false;
  // true while the song window's text is put into Ace (not typing)
  let receiving = false;
  let timer = null;

  function send() {
    timer = null;
    if (sentText === null) return; // the song hasn't arrived yet
    const text = editor.getValue();
    const { row, column } = editor.getCursorPosition();
    const mid = isMidCommand(editor.session.getLine(row).slice(0, column));
    // new text, or the cursor left the brackets with text still to draw
    if (text === sentText && !(sentMid && !mid)) return;
    sentText = text;
    sentMid = mid;
    sendToPartner(EDIT_EVENTS.TYPED, { text, mid });
  }

  function typed() {
    if (receiving) return;
    clearTimeout(timer);
    timer = setTimeout(send, TYPING_PAUSE);
  }
  editor.on('change', typed);
  // moving the cursor out of a half-typed chord draws what was held back
  editor.selection.on('changeCursor', () => {
    if (sentMid) typed();
  });
  // so does leaving the window
  window.addEventListener('blur', () => {
    if (timer === null) return;
    clearTimeout(timer);
    send();
  });

  onWindowEvent(EDIT_EVENTS.SONG, ({ text, title }) => {
    if (typeof title === 'string') {
      const shown = `Edit: ${title}`;
      document.title = `${shown} · UkeGeeks Studio`;
      tauri().window.getCurrentWindow().setTitle(shown).catch((err) => console.warn('[studio] setTitle:', err));
    }
    if (typeof text !== 'string') return;
    const first = sentText === null;
    if (!first && text === editor.getValue()) return;
    receiving = true;
    try {
      if (first) {
        editor.session.setValue(text); // a new undo history: Undo doesn't empty the song
      } else {
        // changed in the song window (Transpose, the Chord Builder): one step for Undo
        const cursor = editor.getCursorPosition();
        editor.setValue(text, -1);
        editor.moveCursorToPosition(cursor);
      }
    } finally {
      receiving = false;
    }
    sentText = text;
    sentMid = false;
    if (first) editor.focus();
  });

  sendToPartner(EDIT_EVENTS.READY);
  window.studioAce = editor; // studioAce.getValue() in the Web Inspector console
}

try {
  main();
} catch (err) {
  console.error('[studio]', err);
  showProblem(errorMessage(err));
}
