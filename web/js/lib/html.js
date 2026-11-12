/**
 * Escaping text for the pages' HTML. Two kinds, because ChordPro songs legitimately
 * hold HTML entities ("Lyrics &amp; Music &copy; 1933") and file names don't.
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

// "&" that does NOT already start an entity like &amp; &copy; &#39; &#x2665;
const BARE_AMP_OR_SPECIAL = /&(?!#\d+;|#x[0-9a-f]+;|[a-z][a-z0-9]*;)|[<>"']/gi;

/**
 * For text from a song (titles, artists, lyric lines): escapes <, >, quotes and bare
 * &, but leaves existing entities alone (like PHP's htmlspecialchars with
 * double_encode=false), so "&copy;" shows as ©. An entity can't open a tag or leave a
 * quoted attribute, so this is still XSS-safe. From the Songbook's server/lib/html.js
 * (f63b6fe), unchanged.
 */
export function escapeHtml(value) {
  return String(value).replace(BARE_AMP_OR_SPECIAL, (c) => ESCAPES[c]);
}

/**
 * For everything else (paths, file names, songbook names, messages), and always for
 * values read back from the page (data- attributes): every & is escaped, so the text
 * comes back exactly as it went in. A folder really named "Tom &amp; Jerry" stays that.
 */
export function escapeText(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}
