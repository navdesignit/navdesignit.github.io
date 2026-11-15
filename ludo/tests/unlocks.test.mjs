import test from 'node:test';
import assert from 'node:assert/strict';
import { MOVIES, FOODS, UNLOCKS } from '../js/unlocks.js';

test('the kill collection has 100 films and 60 dishes, no repeats', () => {
  assert.equal(MOVIES.length, 100);
  assert.equal(FOODS.length, 60);
  assert.equal(UNLOCKS.length, 160);
  assert.equal(new Set(UNLOCKS.map(([, name]) => name)).size, 160, 'every unlock is unique');
  assert.ok(UNLOCKS.every(([icon, name]) => icon && name), 'every entry has an icon and a name');
  assert.equal(UNLOCKS[0][1], 'Sholay', 'the first kill unlocks Sholay');
});
