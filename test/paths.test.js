/** Tests for the pages' plain helpers: web/js/lib/paths.js and web/js/lib/html.js. */
import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeHtml, escapeText } from '../web/js/lib/html.js';
import { cleanPath, folderName, joinPath, parentName, splitPath } from '../web/js/lib/paths.js';

test('splitPath and joinPath work with Mac and Windows paths', () => {
  assert.deepEqual(splitPath('/Users/me/songs/a.cpm'), { dir: '/Users/me/songs', name: 'a.cpm' });
  assert.deepEqual(splitPath('C:\\Users\\me\\songs\\a.cpm'), { dir: 'C:\\Users\\me\\songs', name: 'a.cpm' });
  assert.equal(joinPath('/Users/me/songs/', 'a.cpm'), '/Users/me/songs/a.cpm');
  assert.equal(joinPath('C:\\songs', 'a.cpm'), 'C:\\songs\\a.cpm');
});

test('folderName and parentName name a folder and the one above it', () => {
  assert.equal(folderName('/Users/me/UkeGeeks/cpm/'), 'cpm');
  assert.equal(parentName('/Users/me/UkeGeeks/cpm/'), 'UkeGeeks');
  assert.equal(folderName('C:\\Music\\songs'), 'songs');
  assert.equal(parentName('/cpm'), '');
  assert.equal(folderName('/'), '/');
});

test('cleanPath compares paths whatever their trailing slash or Unicode form', () => {
  assert.equal(cleanPath('/a/Cafe\u0301/'), cleanPath('/a/Caf\u00e9'));
});

test('escapeHtml keeps a song\'s entities; escapeText keeps the text exactly', () => {
  assert.equal(escapeHtml('Lyrics &amp; Music &copy; <1933> "x"'), 'Lyrics &amp; Music &copy; &lt;1933&gt; &quot;x&quot;');
  assert.equal(escapeHtml('Tom & Jerry'), 'Tom &amp; Jerry');
  // a folder really named "Tom &amp; Jerry" must come back from a data- attribute unchanged
  assert.equal(escapeText('Tom &amp; Jerry'), 'Tom &amp;amp; Jerry');
  assert.equal(escapeText('<a href="x">\'</a>'), '&lt;a href=&quot;x&quot;&gt;&#39;&lt;/a&gt;');
});
