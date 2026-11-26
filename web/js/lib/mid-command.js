/**
 * "Mid-command": the cursor is inside a chord or a directive that isn't finished yet,
 * like `[A` on the way to `[Am7]`, or `{title: Hel`. The Edit window (edit-window.js)
 * doesn't redraw the songsheet then: half a chord name is another chord, and half a
 * directive is lyrics.
 *
 * Plain functions, tested in test/mid-command.test.js.
 */

/** Is the last `open` before the cursor still waiting for its `close`? */
function isOpen(text, open, close) {
  const at = text.lastIndexOf(open);
  return at >= 0 && text.indexOf(close, at) < 0;
}

/**
 * @param {string} lineBeforeCursor the cursor's line, up to the cursor
 * @returns {boolean} true while a `[` or `{` on that line hasn't been closed before the
 *   cursor. (A closing bracket after the cursor doesn't count: Ace adds one as soon as
 *   the opening one is typed.)
 */
export function isMidCommand(lineBeforeCursor) {
  const text = String(lineBeforeCursor || '');
  return isOpen(text, '[', ']') || isOpen(text, '{', '}');
}
