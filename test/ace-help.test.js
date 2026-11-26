/**
 * Tests for web/js/lib/ace-help.js.
 */
import assert from 'node:assert/strict';
import test from 'node:test';

import { helpForPlatform } from '../web/js/lib/ace-help.js';

const k = (name) => `<code class="ugsEditor-key">${name}</code>`;
// the rows as the editor writes them (song-editor src/js/editor/aceHelp.ts)
const HELP = `<td>${k('CTRL')} + ${k('F')}</td><td>Find</td>`
  + `<td>${k('CTRL')} + ${k('H')}</td><td>Search &amp; Replace</td>`
  + `<td>${k('CTRL')} + ${k('SPACEBAR')}</td><td>Lists your song's chords</td>`;

test('on a Mac, Find and Replace show the Cmd keys Ace uses there', () => {
  const mac = helpForPlatform(HELP, true);
  assert.ok(mac.includes(`${k('CMD')} + ${k('F')}</td><td>Find`));
  assert.ok(mac.includes(`${k('CMD')} + ${k('OPTION')} + ${k('F')}</td><td>Search &amp; Replace`));
  assert.ok(mac.includes(`${k('CTRL')} + ${k('SPACEBAR')}`), 'Ctrl+Space is the same on a Mac');
});

test('elsewhere the help is unchanged', () => {
  assert.equal(helpForPlatform(HELP, false), HELP);
});
