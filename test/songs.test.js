'use strict';
/**
 * Tests for web/js/songs.js. SongRepository gets a stand-in for Tauri's fs plugin
 * built on Node's fs, which, like Tauri, rejects with plain strings.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const nodeFs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const { SongRepository, parseSong, fixLeadingArticle, filenameToTitle, scrubForFilename } = require('../web/js/songs.js');

const EXT = '.cpm.txt';

/** The subset of Tauri's fs plugin that SongRepository uses. */
function tauriLikeFs() {
  const wrap = (fn) => async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      throw `failed: ${err.message}`; // eslint-disable-line no-throw-literal
    }
  };
  return {
    readDir: wrap(async (dir) => (await nodeFs.readdir(dir, { withFileTypes: true })).map((e) => ({
      name: e.name,
      isFile: e.isFile(),
      isDirectory: e.isDirectory(),
      isSymlink: e.isSymbolicLink(),
    }))),
    stat: wrap(async (p) => {
      const st = await nodeFs.stat(p);
      return { size: st.size, mtime: st.mtime, isFile: st.isFile() };
    }),
    readTextFile: wrap((p) => nodeFs.readFile(p, 'utf8')),
    writeTextFile: wrap((p, text, opts = {}) => nodeFs.writeFile(p, text, { flag: opts.createNew ? 'wx' : 'w' })),
    rename: wrap((from, to) => nodeFs.rename(from, to)),
    remove: wrap((p) => nodeFs.rm(p)),
  };
}

const tempDirs = [];
test.after(() => Promise.all(tempDirs.map((dir) => nodeFs.rm(dir, { recursive: true, force: true }))));

/** A temporary songbook folder with the given files ({name: text}; null makes a folder). */
async function songbook(files, fileExtensions = [EXT]) {
  const dir = await nodeFs.mkdtemp(path.join(os.tmpdir(), 'studio-songs-'));
  tempDirs.push(dir);
  for (const [name, text] of Object.entries(files)) {
    if (text === null) await nodeFs.mkdir(path.join(dir, name));
    else await nodeFs.writeFile(path.join(dir, name), text);
  }
  const repo = new SongRepository({ songDirectory: dir, fileExtensions, maxFileSize: 100000, fs: tauriLikeFs() });
  return { dir, repo };
}

test('parseSong reads the ChordPro tags', () => {
  const song = parseSong('{t: The Rose}\n{st:A subtitle}\n{artist: Bette}\n{album: X}\n{meta: one}\n{ukegeeks-meta: two}\n[C]Hi');
  assert.equal(song.isOK, true);
  assert.equal(song.title, 'The Rose');
  assert.equal(song.subtitle, 'A subtitle');
  assert.equal(song.artist, 'Bette');
  assert.equal(song.album, 'X');
  assert.deepEqual(song.meta, ['one', 'two']);
  assert.equal(parseSong(null).isOK, false);
});

test('titles and filenames', () => {
  assert.equal(fixLeadingArticle('The Rose'), 'Rose, The');
  assert.equal(fixLeadingArticle('A Hard Day'), 'Hard Day, A');
  assert.equal(fixLeadingArticle('Theme'), 'Theme');
  assert.equal(filenameToTitle('space-oddity_bowie'), 'Space Oddity Bowie');
  assert.equal(scrubForFilename('AC/DC: "Hits"?'), 'AC DC Hits');
  assert.equal(scrubForFilename('南山南 - 馬頔'), '南山南 - 馬頔');
});

test('getSongList: songs only, sorted like the Songbook', async () => {
  const { repo } = await songbook({
    'the-rose.cpm.txt': '{title: The Rose}\n{artist: Bette}',
    'b.cpm.txt': '{title: Banana Boat}',
    'song-10.cpm.txt': '[C]no title',
    'song-2.cpm.txt': '[C]no title',
    'notes.txt': 'not a song',
    'folder.cpm.txt': null,
  });
  const list = await repo.getSongList();
  assert.deepEqual(list.map((s) => s.title), ['Banana Boat', 'Rose, The', 'Song 2', 'Song 10']);
  const rose = list[1];
  assert.equal(rose.filename, 'the-rose.cpm.txt');
  assert.equal(rose.artist, 'Bette');
  assert.equal(rose.hasInfo, true);
  // the folder goes along: a new song window doesn't know the open songbook
  const slashed = new SongRepository({ songDirectory: '/My Songs/', fileExtensions: ['.cpm'], maxFileSize: 1, fs: tauriLikeFs() });
  assert.equal(slashed.songUri('the-rose.cpm.txt'), 'editor.html?folder=%2FMy%20Songs&song=the-rose.cpm.txt');
  assert.match(rose.uri, /&song=the-rose\.cpm\.txt$/);
  assert.equal(list[2].hasInfo, false);
});

test('resolve: only names of songs in the folder', async () => {
  const nfd = 'Café'.normalize('NFD') + EXT;
  const { repo } = await songbook({ 'the-rose.cpm.txt': 'x', [nfd]: 'y' });
  assert.equal(await repo.resolve('the-rose'), 'the-rose.cpm.txt');
  assert.equal(await repo.resolve('the-rose.cpm.txt'), 'the-rose.cpm.txt');
  assert.equal(await repo.resolve('the-rose.html'), 'the-rose.cpm.txt');
  assert.equal(await repo.resolve('Café'.normalize('NFC')), nfd);
  for (const bad of ['missing', '../the-rose', 'a/the-rose', 'a\\the-rose', '.the-rose', '', 42, null]) {
    assert.equal(await repo.resolve(bad), null, String(bad));
  }
});

test('several song extensions: .cpm first, .cpm.txt too', async () => {
  const files = {
    'a.cpm': '{title: Apple cpm}',
    'a.cpm.txt': '{title: Apple txt}',
    'b.cpm.txt': '{title: Banana txt}',
    'C.CPM': '{title: Cherry upper}',
    'notes.txt': 'x',
  };
  const cpmOnly = (await songbook(files, ['.cpm'])).repo;
  assert.deepEqual((await cpmOnly.getSongList()).map((s) => s.filename), ['a.cpm', 'C.CPM']);
  assert.equal(await cpmOnly.resolve('b'), null);
  assert.equal(await cpmOnly.resolve('b.cpm.txt'), null);

  const both = (await songbook(files, ['.cpm', '.cpm.txt'])).repo;
  const list = await both.getSongList();
  assert.deepEqual(list.map((s) => s.filename), ['a.cpm', 'a.cpm.txt', 'b.cpm.txt', 'C.CPM']);
  assert.deepEqual(list.map((s) => s.uri.replace(/^.*&/, '')).slice(0, 2), ['song=a.cpm', 'song=a.cpm.txt']);
  assert.equal(both.baseName('a.cpm.txt'), 'a');
  assert.equal(both.baseName('C.CPM'), 'C');
  // a bare name tries the extensions in order
  assert.equal(await both.resolve('a'), 'a.cpm');
  assert.equal(await both.resolve('b'), 'b.cpm.txt');
  assert.equal(await both.resolve('a.cpm.txt'), 'a.cpm.txt');
  // new songs get the first extension
  assert.equal(await both.create('New', ''), 'New.cpm');
});

test('pathFor refuses anything but a bare filename', async () => {
  const { dir, repo } = await songbook({});
  assert.equal(repo.pathFor('a.cpm.txt'), `${dir}/a.cpm.txt`);
  for (const bad of ['../a', 'a/b', 'a\\b', '..', '.', '', 'a\0b']) {
    assert.throws(() => repo.pathFor(bad), /outside song directory/, bad);
  }
});

test('read and load', async () => {
  const { repo } = await songbook({ 'a.cpm.txt': '{title: A}\n[C]x' });
  assert.equal(await repo.read('a.cpm.txt'), '{title: A}\n[C]x');
  const missing = await repo.load('nope');
  assert.equal(missing.filename, null);
  assert.equal(missing.song.isOK, false);
  const found = await repo.load('a');
  assert.equal(found.filename, 'a.cpm.txt');
  assert.equal(found.song.title, 'A');
});

test('update replaces the text and leaves no temp file', async () => {
  const { dir, repo } = await songbook({ 'a.cpm.txt': '{title: Old}' });
  assert.equal((await repo.getSongList())[0].title, 'Old');
  await repo.update('a.cpm.txt', '{title: New}\n[G]sung');
  assert.equal(await nodeFs.readFile(path.join(dir, 'a.cpm.txt'), 'utf8'), '{title: New}\n[G]sung');
  assert.deepEqual(await nodeFs.readdir(dir), ['a.cpm.txt']);
  assert.equal((await repo.getSongList())[0].title, 'New');
});

test('update cleans up its temp file when the rename fails', async () => {
  const { dir, repo } = await songbook({ 'a.cpm.txt': 'old' });
  repo.fs.rename = async () => {
    throw 'rename failed'; // eslint-disable-line no-throw-literal
  };
  await assert.rejects(repo.update('a.cpm.txt', 'new'), /rename failed/);
  assert.deepEqual(await nodeFs.readdir(dir), ['a.cpm.txt']);
  assert.equal(await nodeFs.readFile(path.join(dir, 'a.cpm.txt'), 'utf8'), 'old');
});

test('create names new songs "Title - Artist" and never overwrites', async () => {
  const { dir, repo } = await songbook({ 'hello - me.cpm.txt': 'existing' });
  const name = await repo.create('Hello', 'Me');
  assert.equal(name, 'Hello - Me (2).cpm.txt'); // "hello - me" is taken: names ignore case
  assert.equal(await nodeFs.readFile(path.join(dir, name), 'utf8'), '{title: Hello}\n{artist: Me}\n\nTYPE_YOUR_SONG_HERE\n');
  assert.equal(await nodeFs.readFile(path.join(dir, 'hello - me.cpm.txt'), 'utf8'), 'existing');
  assert.equal(await repo.create('{Odd}/Title', ''), ' Odd Title.cpm.txt'.trim());
});

test('create takes a base name instead of "Title - Artist"', async () => {
  const { repo } = await songbook({});
  assert.equal(await repo.create('Hello', 'Me', 'Me - Hello'), 'Me - Hello.cpm.txt');
  assert.equal(await repo.create('Hello', 'Me', 'Me - Hello'), 'Me - Hello (2).cpm.txt');
});

test('updateAs saves under a new name, keeps the extension, never overwrites', async () => {
  const { dir, repo } = await songbook({ 'old.cpm.txt': 'old', 'Taken.cpm.txt': 'other song' });
  const name = await repo.updateAs('old.cpm.txt', 'Taken', 'new text');
  assert.equal(name, 'Taken (2).cpm.txt');
  assert.deepEqual((await nodeFs.readdir(dir)).sort(), ['Taken (2).cpm.txt', 'Taken.cpm.txt']);
  assert.equal(await nodeFs.readFile(path.join(dir, name), 'utf8'), 'new text');
  assert.equal(await nodeFs.readFile(path.join(dir, 'Taken.cpm.txt'), 'utf8'), 'other song');
});

test('updateAs is a plain update when the name stays (or changes only in case)', async () => {
  const { dir, repo } = await songbook({ 'hello.cpm.txt': 'old' });
  assert.equal(await repo.updateAs('hello.cpm.txt', 'Hello', 'new'), 'hello.cpm.txt');
  assert.equal(await repo.updateAs('hello.cpm.txt', '', 'newer'), 'hello.cpm.txt');
  assert.deepEqual(await nodeFs.readdir(dir), ['hello.cpm.txt']);
  assert.equal(await nodeFs.readFile(path.join(dir, 'hello.cpm.txt'), 'utf8'), 'newer');
});

test('updateAs can rename back to a name the song itself had', async () => {
  const { repo } = await songbook({ 'A.cpm.txt': 'a' });
  const b = await repo.updateAs('A.cpm.txt', 'B', 'b');
  assert.equal(b, 'B.cpm.txt');
  assert.equal(await repo.updateAs(b, 'A', 'a again'), 'A.cpm.txt');
});
