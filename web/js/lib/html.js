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

// Named entities that turn up in songs; anything else is left as typed.
const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '©', reg: '®', trade: '™', deg: '°', hellip: '…', mdash: '—', ndash: '–',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', middot: '·', bull: '•',
  frac12: '½', frac14: '¼', frac34: '¾', sharp: '♯', flat: '♭', natural: '♮', hearts: '♥',
  aacute: 'á', agrave: 'à', acirc: 'â', atilde: 'ã', auml: 'ä', aring: 'å', aelig: 'æ', ccedil: 'ç',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', iacute: 'í', igrave: 'ì', icirc: 'î', iuml: 'ï',
  ntilde: 'ñ', oacute: 'ó', ograve: 'ò', ocirc: 'ô', otilde: 'õ', ouml: 'ö', oslash: 'ø',
  uacute: 'ú', ugrave: 'ù', ucirc: 'û', uuml: 'ü', yacute: 'ý', yuml: 'ÿ', szlig: 'ß',
  Aacute: 'Á', Agrave: 'À', Auml: 'Ä', Aring: 'Å', Ccedil: 'Ç', Eacute: 'É', Ntilde: 'Ñ',
  Oacute: 'Ó', Ouml: 'Ö', Oslash: 'Ø', Uacute: 'Ú', Uuml: 'Ü', iexcl: '¡', iquest: '¿',
};

const codePoint = (n) => (n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : null);

/**
 * Song text as a reader sees it, for places that show plain text rather than HTML
 * (window titles, menus, dialogs): "Rock &amp; Roll &copy; 1956" -> "Rock & Roll © 1956".
 * Numeric entities and common named ones are decoded; an unknown name stays as typed.
 */
export function decodeEntities(value) {
  return String(value).replace(/&(#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/gi, (whole, name) => {
    if (name[0] === '#') {
      const n = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      return codePoint(n) ?? whole;
    }
    return Object.hasOwn(NAMED, name) ? NAMED[name] : whole;
  });
}
