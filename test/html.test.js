/**
 * Tests for web/js/lib/html.js.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { decodeEntities, escapeHtml, escapeText } from '../web/js/lib/html.js';

test('decodeEntities: named, decimal and hex entities', () => {
  assert.equal(decodeEntities('Rock &amp; Roll &copy; 1956'), 'Rock & Roll © 1956');
  assert.equal(decodeEntities('Caf&eacute; &#39;Ol&#233;&#39; &#x2665;'), "Café 'Olé' ♥");
  assert.equal(decodeEntities('&quot;Hi&quot; &lt;3'), '"Hi" <3');
});

test('decodeEntities: leaves unknown names, bad numbers and bare & alone', () => {
  assert.equal(decodeEntities('&notanentity; &#0; &#xD800; Tom & Jerry'), '&notanentity; &#0; &#xD800; Tom & Jerry');
  assert.equal(decodeEntities('&toString; &constructor;'), '&toString; &constructor;');
});

test('decodeEntities decodes once: &amp;amp; shows as &amp;', () => {
  assert.equal(decodeEntities('&amp;amp;'), '&amp;');
});

test('escapeHtml keeps entities; escapeText escapes every &', () => {
  assert.equal(escapeHtml('A &amp; B & <C>'), 'A &amp; B &amp; &lt;C&gt;');
  assert.equal(escapeText('A &amp; B'), 'A &amp;amp; B');
});
