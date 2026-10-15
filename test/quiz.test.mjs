import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose, decompose, romanize, speakable } from '../web/hangul.js';
import { GROUPS, JAMO, buildSyllables, syllableVariants, similarItems, itemFor } from '../web/data.js';
import { newState, pickNext, recordAnswer, pickDistractors, recordOf, MAX_BOX } from '../web/quiz.js';

// Small deterministic PRNG so the simulations are repeatable.
function rng(seed = 1) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

test('compose / decompose / romanize', () => {
  assert.equal(compose('ㅎ', 'ㅏ', 'ㄴ'), '한');
  assert.equal(compose('ㄱ', 'ㅡ', 'ㄹ'), '글');
  assert.deepEqual(decompose('한'), ['ㅎ', 'ㅏ', 'ㄴ']);
  assert.equal(romanize('한'), 'han');
  assert.equal(romanize('글'), 'geul');
  assert.equal(romanize('아'), 'a');
  assert.equal(romanize('밥'), 'bap');
  assert.equal(romanize('옷'), 'ot');
  assert.equal(romanize('강'), 'gang');
  assert.equal(speakable('ㅓ'), '어');
  assert.equal(speakable('ㄱ'), '가');
});

test('every jamo item uses compatibility jamo and has a unique answer label', () => {
  const items = Object.values(JAMO);
  assert.equal(items.length, 40);
  for (const i of items) assert.ok(i.id.charCodeAt(0) >= 0x3131 && i.id.charCodeAt(0) <= 0x318e, i.id);
  assert.equal(new Set(items.map(i => i.roman)).size, items.length);
});

test('syllable pools follow the selected letters', () => {
  const s1 = GROUPS.find(g => g.id === 's1');
  assert.equal(buildSyllables(s1, ['s1']).length, 10 * 6); // falls back to basic consonants x basic vowels
  assert.equal(buildSyllables(s1, ['v1', 'v2', 'c1', 'c2', 's1']).length, 14 * 10);
  const s2 = GROUPS.find(g => g.id === 's2');
  assert.equal(buildSyllables(s2, ['s2']).length, 10 * 6 * 8);
});

test('gradual introduction starts with three letters and holds back while letters are weak', () => {
  const pool = GROUPS[0].items.map(i => i.id);
  const state = newState();
  const r = rng(7);
  const introduced = [];
  for (let n = 0; n < 3; n++) {
    const p = pickNext(pool, 'read', state, { rng: r });
    assert.ok(p.isNew);
    introduced.push(p.id);
    recordAnswer(state, 'read', p.id, ['x'], { rng: r }); // got each one wrong
  }
  assert.deepEqual(introduced, ['ㅏ', 'ㅓ', 'ㅗ']);
  for (let n = 0; n < 20; n++) {
    const p = pickNext(pool, 'read', state, { rng: r });
    assert.ok(!p.isNew, 'no new letters while three are weak');
    recordAnswer(state, 'read', p.id, ['x'], { rng: r });
  }
});

test('a mistake brings the letter back within a few questions', () => {
  const pool = GROUPS[0].items.map(i => i.id);
  const state = newState();
  const r = rng(3);
  recordAnswer(state, 'read', 'ㅏ', ['ㅓ'], { rng: r });
  let seenAgain = -1;
  for (let n = 1; n <= 6 && seenAgain < 0; n++) {
    const p = pickNext(pool, 'read', state, { gradual: false, rng: r });
    if (p.id === 'ㅏ' && p.again) seenAgain = n;
    recordAnswer(state, 'read', p.id, [], { rng: r });
  }
  assert.ok(seenAgain >= 1 && seenAgain <= 5, `came back after ${seenAgain}`);
  assert.equal(state.confusions['ㅏ']['ㅓ'], 1);
});

test('a perfect learner eventually knows the whole set', () => {
  const pool = GROUPS.find(g => g.id === 'c1').items.map(i => i.id);
  const state = newState();
  const r = rng(11);
  for (let n = 0; n < 200; n++) {
    const p = pickNext(pool, 'read', state, { rng: r });
    recordAnswer(state, 'read', p.id, [], { rng: r });
  }
  for (const id of pool) assert.ok(recordOf(state, 'read', id).box >= 3, `${id} box ${recordOf(state, 'read', id).box}`);
});

test('weak letters are asked more often than known ones', () => {
  const pool = GROUPS[0].items.map(i => i.id);
  const state = newState();
  for (const id of pool) state.items[`read|${id}`] = { box: MAX_BOX, seen: 10, right: 10, wrong: 0 };
  state.items['read|ㅡ'].box = 0;
  const r = rng(5);
  const counts = {};
  for (let n = 0; n < 600; n++) {
    const p = pickNext(pool, 'read', state, { rng: r });
    counts[p.id] = (counts[p.id] || 0) + 1;
    state.recent = []; // measure raw weighting only
  }
  assert.ok(counts['ㅡ'] > 300, JSON.stringify(counts));
});

test('distractors are distinct, exclude the answer, and favour look-alikes', () => {
  const state = newState();
  const r = rng(9);
  const item = JAMO['ㄱ'];
  const consonants = Object.values(JAMO).filter(i => !i.vowel);
  let similarHits = 0;
  for (let n = 0; n < 200; n++) {
    const d = pickDistractors(item, 5, 'read', consonants, state, { similar: similarItems, rng: r });
    assert.equal(d.length, 4);
    assert.ok(!d.includes(item));
    assert.equal(new Set(d.map(i => i.roman)).size, 4);
    if (d.some(i => i.id === 'ㅋ' || i.id === 'ㄲ')) similarHits++;
  }
  assert.ok(similarHits > 150, `look-alikes in ${similarHits}/200`);
});

test('syllable distractors never share the answer romanization', () => {
  const state = newState();
  const r = rng(13);
  const groups = ['v1', 'c1', 's2'];
  for (const block of ['갓', '낟', '밥', '솜']) {
    const item = itemFor(block);
    const d = pickDistractors(item, 5, 'read', syllableVariants(block, groups), state, { similar: similarItems, rng: r });
    assert.equal(d.length, 4);
    assert.ok(d.every(x => x.roman !== item.roman), `${block}: ${d.map(x => x.roman)}`);
  }
});

test('play mode picks from the whole pool, without intros or requeues', () => {
  const pool = GROUPS.find(g => g.id === 'c1').items.map(i => i.id);
  const state = newState();
  const r = rng(17);
  recordAnswer(state, 'read', 'ㄱ', ['ㅋ'], { rng: r }); // would normally be requeued
  const seen = new Set();
  for (let n = 0; n < 200; n++) {
    const p = pickNext(pool, 'read', state, { play: true, rng: r });
    assert.ok(!p.isNew && !p.again);
    seen.add(p.id);
    recordAnswer(state, 'read', p.id, [], { rng: r });
  }
  assert.equal(seen.size, pool.length);
});
