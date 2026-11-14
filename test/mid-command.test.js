import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isMidCommand } from '../web/js/lib/mid-command.js';

test('plain lyrics are not mid-command', () => {
  assert.equal(isMidCommand(''), false);
  assert.equal(isMidCommand('Some say love'), false);
  assert.equal(isMidCommand(undefined), false);
});

test('an open chord is mid-command until its bracket closes', () => {
  assert.equal(isMidCommand('Some ['), true);
  assert.equal(isMidCommand('Some [A'), true);
  assert.equal(isMidCommand('Some [Am7'), true);
  assert.equal(isMidCommand('Some [Am7]'), false);
  assert.equal(isMidCommand('Some [Am7] say'), false);
});

test('an open directive is mid-command until its brace closes', () => {
  assert.equal(isMidCommand('{'), true);
  assert.equal(isMidCommand('{title: Hel'), true);
  assert.equal(isMidCommand('{title: Hello}'), false);
  assert.equal(isMidCommand('{define: G7 frets 0 2 1'), true);
});

test('only the last bracket before the cursor matters', () => {
  assert.equal(isMidCommand('[C]Some say [G'), true);
  assert.equal(isMidCommand('[C]Some [G7]say'), false);
  assert.equal(isMidCommand('{c: Verse} [C'), true);
});

test('a stray closing bracket is not mid-command', () => {
  assert.equal(isMidCommand('Some ] say'), false);
  assert.equal(isMidCommand('} [C]la'), false);
});
