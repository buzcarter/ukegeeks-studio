/**
 * Searching the Library: songs by title, artist or lyrics. Plain functions with no
 * file access, so they're tested in Node (test/search.test.js); the song list builds
 * the entries from the songbooks' files (web/js/list.js).
 *
 * - Case, accents and curly quotes don't matter ("cafe" finds "Café").
 * - Lyrics are the song's words without chords or directives, so "hello world"
 *   finds "[C]Hello [G]world", and tabs ({start_of_tab} … {end_of_tab}) are skipped.
 * - Every word of the search must be somewhere in the title, artist or lyrics; a
 *   word can be the start or middle of a longer one ("love" finds "lovely").
 * - Title matches rank first, then artist, then lyrics; the whole search as a phrase
 *   ranks higher than scattered words.
 */

/** Text for comparing: lower case, no accents, straight quotes, single spaces. */
export function fold(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** A song's lyric lines: no directives, comments, tabs or chords; blank lines dropped. */
export function lyricLines(body) {
  const text = String(body || '')
    // tab and grid blocks are music, not words
    .replace(/\{\s*(?:sot|start_of_tab|sog|start_of_grid)\s*(?::[^}]*)?\}[\s\S]*?\{\s*(?:eot|end_of_tab|eog|end_of_grid)\s*\}/gi, '')
    .replace(/\{[^}]*\}/g, '') // directives: {title: …}, {c: …}, {soc} …
    .replace(/\[[^\]]*\]/g, ''); // chords
  return text
    .split(/\r?\n/)
    .filter((line) => !/^\s*#/.test(line)) // ChordPro comments
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/**
 * An entry for searchSongs(): the song's own fields plus folded copies to compare.
 * @param {{ folder: string, songbook: string, filename: string, title: string, artist: string, body: string }} song
 */
export function makeEntry(song) {
  const lines = lyricLines(song.body);
  return {
    folder: song.folder,
    songbook: song.songbook,
    filename: song.filename,
    title: song.title || '',
    artist: song.artist || '',
    lines,
    folded: {
      title: fold(song.title),
      artist: fold(song.artist),
      lines: lines.map(fold),
    },
  };
}

/** The search's words, folded; quotes around a phrase are ignored. */
function wordsOf(query) {
  return fold(query).replace(/["]/g, ' ').split(' ').filter(Boolean);
}

/** The first lyric line with the phrase, else with the first word that's only in the lyrics. */
function snippetFor(entry, phrase, words) {
  const { lines } = entry.folded;
  let i = lines.findIndex((line) => line.includes(phrase));
  if (i < 0) {
    const word = words.find((w) => !entry.folded.title.includes(w) && !entry.folded.artist.includes(w)) || words[0];
    i = lines.findIndex((line) => line.includes(word));
  }
  if (i < 0) return '';
  const line = entry.lines[i];
  return line.length > 120 ? `${line.slice(0, 117)}…` : line;
}

/**
 * The entries matching the search, best first: [{ entry, where, snippet }]. where is
 * 'title', 'artist' or 'lyrics' (the best place it matched); snippet is a lyric line
 * when the lyrics were needed for the match, else ''.
 */
export function searchSongs(entries, query, { limit = 300 } = {}) {
  const words = wordsOf(query);
  if (!words.length) return [];
  const phrase = words.join(' ');
  const results = [];
  for (const entry of entries) {
    const { title, artist, lines } = entry.folded;
    const lyrics = lines.join('\n');
    let score = 0;
    let needsLyrics = false;
    let ok = true;
    for (const word of words) {
      const inTitle = title.includes(word);
      const inArtist = artist.includes(word);
      const inLyrics = !inTitle && !inArtist && lyrics.includes(word);
      if (!inTitle && !inArtist && !inLyrics) {
        ok = false;
        break;
      }
      if (inTitle) score += title.startsWith(word) || title.includes(` ${word}`) ? 15 : 10;
      if (inArtist) score += 6;
      if (inLyrics) {
        score += 1;
        needsLyrics = true;
      }
    }
    if (!ok) continue;
    if (title.includes(phrase)) score += 20;
    if (title === phrase) score += 20;
    if (artist.includes(phrase)) score += 12;
    if (needsLyrics && lines.some((line) => line.includes(phrase))) score += 8;
    const where = words.some((w) => title.includes(w)) ? 'title' : words.some((w) => artist.includes(w)) ? 'artist' : 'lyrics';
    results.push({ entry, score, where, snippet: needsLyrics ? snippetFor(entry, phrase, words) : '' });
  }
  results.sort((a, b) => b.score - a.score
    || a.entry.title.localeCompare(b.entry.title, undefined, { sensitivity: 'base', numeric: true })
    || a.entry.songbook.localeCompare(b.entry.songbook));
  return results.slice(0, limit).map(({ entry, where, snippet }) => ({ entry, where, snippet }));
}
