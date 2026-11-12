/**
 * Song file access: listing, safe filename resolution, ChordPro metadata parsing,
 * the (in-memory) song list cache, creating and updating songs.
 * Ports ugsphp/classes/{FileHelper,SongHelper,SongListCacheManager,FileWriter}.php
 *
 * From the UkeGeeks Songbook's server/lib/songs.js (f63b6fe). In UkeGeeks Studio the
 * file access goes through Tauri's fs plugin instead of Node's fs: SongRepository is
 * given an `fs` object with the plugin's function names (window.__TAURI__.fs in the
 * app, a small Node stand-in in the tests). The ChordPro and filename functions are
 * unchanged.
 *
 * An ES module: the pages import it, and so do the tests (test/songs.test.js, in Node).
 *
 * Security model: a song id from a URL or request body is NEVER joined onto a path
 * directly. It's normalized to a bare filename, then must match a file that actually
 * exists in the song directory listing. That makes path traversal impossible.
 */

const NOT_FOUND_SONG = Object.freeze({
  isOK: false,
  title: 'Sorry... Song Not Found',
  subtitle: 'Check your link, please',
  artist: '',
  album: '',
  body: '[D]Where, oh, where has this [A7]stupid file gone?\nOh, [G]where or where can it [D]be?',
  meta: [],
});

function firstMatch(text, regex, group) {
  const m = regex.exec(text);
  return m ? m[group].trim() : '';
}

/**
 * Pulls title/subtitle/artist/album/meta tags out of ChordPro text.
 * @param {string|null} text
 */
function parseSong(text) {
  if (!text) {
    return { ...NOT_FOUND_SONG, meta: [] };
  }
  const meta = [];
  for (const m of text.matchAll(/{(?:ukegeeks-meta|meta)\s*:\s*(.+?)}/gi)) {
    meta.push(m[1]);
  }
  return {
    isOK: true,
    title: firstMatch(text, /{(t|title)\s*:\s*(.+?)}/i, 2),
    subtitle: firstMatch(text, /{(st|subtitle)\s*:\s*(.+?)}/i, 2),
    artist: firstMatch(text, /{artist\s*:\s*(.+?)}/i, 1),
    album: firstMatch(text, /{album\s*:\s*(.+?)}/i, 1),
    meta,
    body: text,
  };
}

/** "The Rose" -> "Rose, The" */
function fixLeadingArticle(title) {
  return title.replace(/^(the|a|an) (.*)$/i, '$2, $1');
}

function filenameToTitle(name) {
  return name
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

/**
 * Makes a string safe to use as (part of) a filename on macOS, Linux and Windows,
 * while keeping Unicode titles (e.g. Chinese) readable.
 */
function scrubForFilename(value, maxLength = 120) {
  const cleaned = String(value || '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex -- control characters are exactly what must go
    .replace(/[/\\:*?"<>|\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '');
  return Array.from(cleaned).slice(0, maxLength).join('').trim();
}

/** Text used inside a ChordPro {tag: ...}; braces and newlines would break the tag. */
function scrubForTag(value) {
  return String(value || '').replace(/[{}\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

class SongRepository {
  /**
   * @param {{songDirectory: string, fileExtension: string, maxFileSize: number, sortLocale?: string, fs: object}} cfg
   *   fs: readDir, stat, readTextFile, writeTextFile, rename, remove, as in Tauri's fs plugin
   */
  constructor(cfg) {
    this.fs = cfg.fs;
    this.dir = cfg.songDirectory.replace(/[/\\]+$/, '');
    // Tauri hands back "\" paths on Windows; both separators work there
    this.sep = this.dir.includes('\\') && !this.dir.includes('/') ? '\\' : '/';
    // Song file extensions, the first used for new songs: [".cpm"], or [".cpm", ".cpm.txt"]
    // to also list the Songbook's ".cpm.txt" files. (The Songbook takes one fileExtension.)
    this.exts = (cfg.fileExtensions || [cfg.fileExtension]).map((ext) => ext.toLowerCase());
    this.ext = this.exts[0];
    this.maxFileSize = cfg.maxFileSize;
    this.collator = new Intl.Collator(cfg.sortLocale || undefined, { sensitivity: 'base', numeric: true });
    /** @type {Map<string, {stamp: string, entry: object}>} */
    this.cache = new Map();
  }

  /** The song extension a filename ends with (the longest that matches), or null. */
  extensionOf(name) {
    const lower = name.toLowerCase();
    return this.exts
      .filter((ext) => lower.length > ext.length && lower.endsWith(ext))
      .sort((a, b) => b.length - a.length)[0] || null;
  }

  isSongFilename(name) {
    return this.extensionOf(name) !== null;
  }

  /** Filename without its song extension (".cpm", ".cpm.txt"). */
  baseName(filename) {
    return filename.slice(0, filename.length - (this.extensionOf(filename) || '').length);
  }

  /** @returns {Promise<string[]>} song filenames in the song directory (regular files only) */
  async listFilenames() {
    let entries;
    try {
      entries = await this.fs.readDir(this.dir);
    } catch (err) {
      console.error(`[songs] can't read song directory ${this.dir}: ${errorMessage(err)}`);
      return [];
    }
    return entries
      .filter((e) => e.isFile && this.isSongFilename(e.name))
      .map((e) => e.name)
      .sort();
  }

  /**
   * Converts a song id (from a URL or JSON body) to the filename of an existing song.
   * Accepts "name.cpm", "name.cpm.txt", or "name" / legacy "name.html" (tried with each
   * song extension in order). Returns null when the id is malformed or no such song exists.
   * @param {unknown} id
   * @returns {Promise<string|null>}
   */
  async resolve(id) {
    if (typeof id !== 'string') return null;
    const name = id.normalize('NFC').trim();
    if (!name || name.length > 255 || /[/\\\0]/.test(name) || name.startsWith('.')) {
      return null;
    }
    const candidates = this.isSongFilename(name)
      ? [name]
      : this.exts.map((ext) => name.replace(/\.html?$/i, '') + ext);
    const names = await this.listFilenames();
    for (const candidate of candidates) {
      if (names.includes(candidate)) return candidate;
      // macOS may hand back decomposed (NFD) filenames
      const decomposed = names.find((n) => n.normalize('NFC') === candidate);
      if (decomposed) return decomposed;
    }
    return null;
  }

  /** Absolute path for a filename returned by resolve()/listFilenames(). */
  pathFor(filename) {
    if (typeof filename !== 'string' || !filename || filename === '.' || filename === '..' || /[/\\\0]/.test(filename)) {
      throw new Error('refusing path outside song directory');
    }
    return this.dir + this.sep + filename;
  }

  /** @returns {Promise<string|null>} song text, or null if missing/unreadable */
  async read(filename) {
    try {
      return await this.fs.readTextFile(this.pathFor(filename));
    } catch (err) {
      console.error(`[songs] read ${filename}: ${errorMessage(err)}`);
      return null;
    }
  }

  /** Reads + parses a song by id. Returns {filename, song} (song is the not-found stub if missing). */
  async load(id) {
    const filename = await this.resolve(id);
    const text = filename ? await this.read(filename) : null;
    return { filename, song: parseSong(text) };
  }

  /**
   * The app's editor page for a song (one song per page, in its own window). The
   * folder goes along, since a new window doesn't know the open songbook; the whole
   * filename, since "x.cpm" and "x.cpm.txt" can sit side by side.
   */
  songUri(filename) {
    return 'editor.html?folder=' + encodeURIComponent(this.dir) + '&song=' + encodeURIComponent(filename);
  }

  async buildEntry(filename) {
    const parsed = parseSong(await this.read(filename));
    const base = this.baseName(filename);
    return {
      filename,
      uri: this.songUri(filename),
      hasInfo: parsed.title.length + parsed.artist.length > 0,
      title: fixLeadingArticle(parsed.title || filenameToTitle(base)),
      subtitle: parsed.subtitle,
      album: parsed.album,
      artist: parsed.artist,
    };
  }

  /**
   * Detailed song list, sorted by title. Entries are cached and only re-parsed when a
   * file's size or modified time changes, so new/edited files show up without a reindex.
   * @param {{force?: boolean}} [opts]
   */
  async getSongList({ force = false } = {}) {
    if (force) this.cache.clear();
    const names = await this.listFilenames();
    const live = new Set(names);

    const list = await Promise.all(
      names.map(async (filename) => {
        let stamp = '';
        try {
          const st = await this.fs.stat(this.pathFor(filename));
          stamp = `${st.size}:${st.mtime ? st.mtime.getTime() : ''}`;
        } catch {
          /* vanished between readdir and stat; parse will yield a stub */
        }
        const hit = this.cache.get(filename);
        if (hit && hit.stamp === stamp) return hit.entry;
        const entry = await this.buildEntry(filename);
        this.cache.set(filename, { stamp, entry });
        return entry;
      })
    );

    for (const key of this.cache.keys()) {
      if (!live.has(key)) this.cache.delete(key);
    }

    return list.sort(
      (a, b) => this.collator.compare(a.title, b.title) || this.collator.compare(a.filename, b.filename)
    );
  }

  /** Simple list (titles derived from filenames), like SongList_Vmb.php */
  async getSimpleSongList() {
    const names = await this.listFilenames();
    return names
      .map((filename) => ({
        uri: this.songUri(filename),
        title: fixLeadingArticle(filenameToTitle(this.baseName(filename))),
      }))
      .sort((a, b) => this.collator.compare(a.title, b.title));
  }

  /**
   * A filename that isn't taken: base + ext, else "base (2)" + ext, and so on.
   * Tauri's errors are plain strings with no "EEXIST" code, so this picks a name that
   * isn't in the listing (macOS and Windows filenames ignore case) instead of retrying.
   * @param {string} [except] a filename that doesn't count as taken (the song being renamed)
   */
  async availableFilename(base, ext = this.ext, except = null) {
    const taken = new Set((await this.listFilenames()).filter((n) => n !== except).map(foldName));
    for (let n = 1; n <= 50; n++) {
      const candidate = (n === 1 ? base : `${base} (${n})`) + ext;
      if (!taken.has(foldName(candidate))) return candidate;
    }
    // pathological: 50 songs with the same name, fall back to a random suffix
    return `${base}.${randomHex(4)}${ext}`;
  }

  /**
   * Creates a new song stub named "Title - Artist" (or the given base name) plus the
   * first song extension (made unique if taken).
   * @param {string} [baseName] the filename without extension, if not "Title - Artist"
   * @returns {Promise<string>} the new filename
   */
  async create(title, artist, baseName) {
    const cleanTitle = scrubForTag(title);
    const cleanArtist = scrubForTag(artist);

    const base = scrubForFilename(baseName || (cleanArtist ? `${cleanTitle} - ${cleanArtist}` : cleanTitle)) || 'untitled';
    const content =
      `{title: ${cleanTitle || 'untitled'}}\n` +
      `{artist: ${cleanArtist || 'traditional'}}\n` +
      '\nTYPE_YOUR_SONG_HERE\n';

    const filename = await this.availableFilename(base);
    // createNew fails if the file exists: never overwrites, even if one appeared since the listing
    await this.fs.writeTextFile(this.pathFor(filename), content, { createNew: true });
    return filename;
  }

  /**
   * Saves a song under a new name: baseName plus the song's own extension (".cpm.txt"
   * stays ".cpm.txt"), made unique if taken. The new file is created new, so nothing is
   * overwritten; then the old file is removed. When the name wouldn't change (or only in
   * case), it's a plain update().
   * @param {string} filename must come from resolve()
   * @returns {Promise<string>} the song's filename now
   */
  async updateAs(filename, baseName, text) {
    const ext = this.extensionOf(filename) || this.ext;
    const base = scrubForFilename(baseName);
    if (!base || foldName(base + ext) === foldName(filename)) {
      await this.update(filename, text);
      return filename;
    }
    const newName = await this.availableFilename(base, ext, filename);
    await this.fs.writeTextFile(this.pathFor(newName), text, { createNew: true });
    try {
      await this.fs.remove(this.pathFor(filename));
    } catch (err) {
      // the song is saved under its new name; the old file stays behind
      console.error(`[songs] remove ${filename} after renaming to ${newName}: ${errorMessage(err)}`);
    }
    this.cache.delete(filename);
    return newName;
  }

  /**
   * Replaces an existing song's text (atomic: temp file + rename).
   * @param {string} filename must come from resolve()
   * @param {string} text
   */
  async update(filename, text) {
    const target = this.pathFor(filename);
    // No leading dot (the Songbook's was ".<hex>.ugs-tmp"): on macOS the folder access
    // Tauri grants doesn't cover dotfiles. Ends in ".ugs-tmp", so never listed as a song.
    const tmp = this.pathFor(`${filename}.${randomHex(6)}.ugs-tmp`);
    try {
      await this.fs.writeTextFile(tmp, text, { createNew: true });
      await this.fs.rename(tmp, target);
    } catch (err) {
      await this.fs.remove(tmp).catch(() => {});
      throw err;
    }
    this.cache.delete(filename);
  }
}

/** Filenames as macOS and Windows compare them: ignoring case and Unicode form. */
function foldName(name) {
  return name.normalize('NFC').toLowerCase();
}

/** Tauri rejects with plain strings; Node with Error objects. */
function errorMessage(err) {
  return err && err.message ? err.message : String(err);
}

function randomHex(bytes) {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(bytes)), (b) => b.toString(16).padStart(2, '0')).join('');
}

// readEditorSettings() (the Songbook's settings file) isn't carried over: the app keeps its settings in Rust.
export { SongRepository, parseSong, fixLeadingArticle, filenameToTitle, scrubForFilename, scrubForTag, foldName };
