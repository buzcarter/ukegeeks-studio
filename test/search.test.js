'use strict';
/** Tests for web/js/search.js: searching the Library by title, artist or lyrics. */
const test = require('node:test');
const assert = require('node:assert/strict');

const load = () => import('../web/js/search.js');

const songs = [
  { title: 'Rose, The', artist: 'Bette Midler', body: '{title: The Rose}\n{artist: Bette Midler}\n[C]Some say [G]love, it is a [F]river' },
  { title: 'Hello World', artist: '', body: '{title: Hello World}\n[C]Hello [G]world, my [F]friend' },
  { title: 'Lovely Day', artist: 'Bill Withers', body: '{title: Lovely Day}\nThen I look at [Am]you' },
  {
    title: 'Café Song', artist: 'Ana', body: '{t: Café Song}\n# a comment about love\n{soc}\nDon’t stop [D]believing\n{eoc}\n{sot}\nA|--love--|\n{eot}',
  },
].map((s, i) => ({ folder: '/f', songbook: i < 2 ? 'Beach' : 'Classics', filename: `s${i}.cpm`, ...s }));

test('lyricLines drops chords, directives, comments and tabs', async () => {
  const { lyricLines } = await load();
  assert.deepEqual(lyricLines(songs[3].body), ['Don’t stop believing']);
  assert.deepEqual(lyricLines(songs[1].body), ['Hello world, my friend']);
});

test('fold ignores case, accents, curly quotes and extra spaces', async () => {
  const { fold } = await load();
  assert.equal(fold('  Café   DON’T '), "cafe don't");
});

test('every word must match: title, artist or lyrics', async () => {
  const { makeEntry, searchSongs } = await load();
  const entries = songs.map(makeEntry);
  const titles = (q) => searchSongs(entries, q).map((r) => r.entry.title);
  assert.deepEqual(titles('hello world'), ['Hello World']);
  assert.deepEqual(titles('midler river'), ['Rose, The']); // artist + lyrics
  assert.deepEqual(titles('cafe'), ['Café Song']);
  assert.deepEqual(titles("don't stop"), ['Café Song']); // straight quote finds a curly one
  assert.deepEqual(titles('bananas'), []);
  assert.deepEqual(titles('   '), []);
});

test('chords between words and tabs, comments do not count', async () => {
  const { makeEntry, searchSongs } = await load();
  const entries = songs.map(makeEntry);
  // "love" is in the Rose's lyrics and Lovely Day's title; not in the Café comment or tab
  const results = searchSongs(entries, 'love');
  assert.deepEqual(results.map((r) => r.entry.title), ['Lovely Day', 'Rose, The']);
  assert.equal(results[0].where, 'title');
  assert.equal(results[0].snippet, '');
  assert.equal(results[1].where, 'lyrics');
  assert.equal(results[1].snippet, 'Some say love, it is a river');
  // "hello world" across a chord
  assert.equal(searchSongs(entries, 'my friend')[0].snippet, 'Hello world, my friend');
});

test('the songbook goes along with each result', async () => {
  const { makeEntry, searchSongs } = await load();
  const [result] = searchSongs(songs.map(makeEntry), 'withers');
  assert.equal(result.entry.songbook, 'Classics');
  assert.equal(result.where, 'artist');
});
