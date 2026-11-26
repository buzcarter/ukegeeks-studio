/**
 * The Edit window's help panel: keyboard shortcuts and ChordPro snippets. The text is
 * the editor's own (`ugsEditorPlus.aceHelpHtml`, the help beside Fullscreen); the song
 * window sends it over, since this window loads only Ace.
 *
 * That text names the Windows keys. On a Mac, Ace's Find is Cmd+F and Replace is
 * Cmd+Option+F (its own bindings: `editor.commands.byName.find.bindKey`), so those rows
 * are rewritten. Ctrl+Space (the song's chords) is the same everywhere.
 */

const key = (name) => `<code class="ugsEditor-key">${name}</code>`;
const keys = (...names) => names.map(key).join(' + ');

const MAC_KEYS = [
  [keys('CTRL', 'F'), keys('CMD', 'F')],
  [keys('CTRL', 'H'), keys('CMD', 'OPTION', 'F')],
];

/** The help HTML with the keys this platform uses. */
export function helpForPlatform(html, isMac) {
  if (!isMac) return html;
  return MAC_KEYS.reduce((text, [windows, mac]) => text.split(windows).join(mac), html);
}
