import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.split('// <core>')[1].split('// </core>')[0];
const { QUESTIONS, assemble, mergeAnswer, mergeRoster, nextQuestion, allDone } =
  new Function(code + '; return {QUESTIONS, assemble, mergeAnswer, mergeRoster, nextQuestion, allDone}')();

const full = (id) => Array.from({ length: 9 }, (_, q) => id + q);
const answersFor = (ids) => Object.fromEntries(ids.map((id) => [id, full(id)]));

test('has the nine questions in order', () => {
  assert.deepEqual(QUESTIONS, ['Who?', 'Where?', 'When?', 'With whom?', 'What were they doing?', 'Why?', 'What did they say?', 'What happened next?', 'How did it end?']);
});

test('assemble rotates answers across the roster', () => {
  const roster = ['a', 'b', 'c'];
  const a = answersFor(roster);
  const s0 = assemble(roster, a, 0);
  assert.deepEqual(s0.slice(0, 4), ['a0', 'b1', 'c2', 'a3']);
  assert.equal(assemble(roster, a, 1)[0], 'b0');
});

test('assemble with one player returns own answers', () => {
  assert.deepEqual(assemble(['a'], answersFor(['a']), 0), full('a'));
});

test('assemble with two players alternates', () => {
  const s = assemble(['a', 'b'], answersFor(['a', 'b']), 0);
  assert.deepEqual(s, ['a0', 'b1', 'a2', 'b3', 'a4', 'b5', 'a6', 'b7', 'a8']);
});

test('assemble shows an ellipsis for missing answers', () => {
  const s = assemble(['a', 'b'], { a: ['x'] }, 0);
  assert.equal(s[0], 'x');
  assert.equal(s[1], '…');
  assert.equal(s.length, 9);
});

test('mergeAnswer is idempotent and does not mutate', () => {
  const start = {};
  const once = mergeAnswer(start, 'a', 2, 'hi');
  const twice = mergeAnswer(once, 'a', 2, 'hi');
  assert.deepEqual(start, {});
  assert.deepEqual(twice, once);
  assert.equal(once.a[2], 'hi');
});

test('mergeRoster converges on the smallest roster', () => {
  assert.deepEqual(mergeRoster(null, ['b', 'a']), ['b', 'a']);
  assert.deepEqual(mergeRoster(['a', 'b'], ['a', 'c']), ['a', 'b']);
  assert.deepEqual(mergeRoster(['a', 'c'], ['a', 'b']), ['a', 'b']);
});

test('nextQuestion finds the first unanswered question', () => {
  assert.equal(nextQuestion({}, 'a'), 0);
  assert.equal(nextQuestion({ a: ['x', 'y', 'z'] }, 'a'), 3);
  assert.equal(nextQuestion(answersFor(['a']), 'a'), 9);
});

test('allDone requires every roster member to have nine answers', () => {
  const a = answersFor(['a', 'b']);
  assert.equal(allDone(['a', 'b'], a), true);
  assert.equal(allDone(['a', 'b', 'c'], a), false);
  assert.equal(allDone(['a', 'b'], { ...a, b: ['x'] }), false);
});
