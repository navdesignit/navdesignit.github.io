import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTERS, CHAR_IDS, avatar, faceMarkup } from '../js/characters.js';

test('every character has a weapon, big blinking eyes (or shades) and shows the weapon on their avatar', () => {
  for (const id of CHAR_IDS) {
    assert.ok(CHARACTERS[id].weapon, `${id} is unarmed`);
    assert.ok(avatar(id).includes(CHARACTERS[id].weapon), `${id}'s avatar has no weapon`);
    assert.ok(!avatar(id, { weapon: false }).includes('f-weapon'), `${id}'s board piece should not double up the weapon`);
    if (id !== 'ajay') assert.ok(faceMarkup(id).includes('f-eye'), `${id} has no blinking eyes`);
  }
  assert.equal(new Set(CHAR_IDS.map(id => CHARACTERS[id].weapon)).size, CHAR_IDS.length, 'weapons are distinct');
});
