/** Tests for the plain functions of web/js/lib/app-settings.js and web/js/lib/library.js (no Tauri needed). */
import assert from 'node:assert/strict';
import test from 'node:test';

import { songExtensions, songFileBase } from '../web/js/lib/app-settings.js';
import { songbookName, suggestSongbookName } from '../web/js/lib/library.js';

test('songFileBase names a file as Settings says', () => {
  assert.equal(songFileBase('The Rose', 'Bette Midler', 'title-artist'), 'The Rose - Bette Midler');
  assert.equal(songFileBase('The Rose', 'Bette Midler', 'artist-title'), 'Bette Midler - The Rose');
  assert.equal(songFileBase('The Rose', 'Bette Midler', 'title'), 'The Rose');
  assert.equal(songFileBase('The Rose', '', 'artist-title'), 'The Rose');
  assert.equal(songFileBase('', 'Bette Midler', 'title-artist'), '');
  assert.equal(songFileBase('A {b}\nc', '', 'title'), 'A b c');
});

test('songExtensions adds ".cpm.txt" with ".txt"', () => {
  assert.deepEqual(songExtensions(['.cpm']), ['.cpm']);
  assert.deepEqual(songExtensions(['.cpm', '.txt']), ['.cpm', '.txt', '.cpm.txt']);
});

test('a songbook is called by its name, else by its folder', () => {
  const library = { songbooks: [{ folder: '/a/cpm', name: 'Beach Party' }] };
  assert.equal(songbookName(library, '/a/cpm'), 'Beach Party');
  assert.equal(songbookName(library, '/b/Campfire'), 'Campfire');
});

test('a new songbook is offered its folder\'s name, or the parent\'s when that says more', () => {
  const library = { songbooks: [{ folder: '/a/Campfire', name: 'Campfire' }] };
  assert.equal(suggestSongbookName(library, '/Users/me/Jam Night'), 'Jam Night');
  assert.equal(suggestSongbookName(library, '/Users/me/Uke Club/songs'), 'Uke Club'); // a plain name
  assert.equal(suggestSongbookName(library, '/b/Tuesday/Campfire'), 'Tuesday'); // taken
  assert.equal(suggestSongbookName(library, '/a/Campfire'), 'Campfire'); // itself
  assert.equal(suggestSongbookName(library, '/cpm'), 'cpm'); // no parent
});
