import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.split('// <core>')[1].split('// </core>')[0];
const { QUESTIONS, assemble, mergeAnswer, mergeRoster, nextQuestion, allDone, reduce, startRoster, viewKey, slideConfirmed, isConfirmKey, cleanAnswer, formatStory } =
  new Function(code + '; return {QUESTIONS, assemble, mergeAnswer, mergeRoster, nextQuestion, allDone, reduce, startRoster, viewKey, slideConfirmed, isConfirmKey, cleanAnswer, formatStory}')();

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

test('mergeRoster is the sorted union, so a late solo Start never evicts anyone', () => {
  assert.deepEqual(mergeRoster(null, ['b', 'a']), ['a', 'b']);
  assert.deepEqual(mergeRoster(['a', 'b', 'c'], ['0']), ['0', 'a', 'b', 'c']);
  assert.deepEqual(mergeRoster(['a', 'c'], ['a', 'b']), ['a', 'b', 'c']);
  assert.deepEqual(mergeRoster(['a', 'b'], ['a', 'b']), ['a', 'b']);
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

const fresh = (id = 'me') => ({ playerId: id, known: [id], roster: null, answers: {} });

test('reduce hello records each player once', () => {
  let st = reduce(fresh(), 'hello', { playerId: 'b' });
  st = reduce(st, 'hello', { playerId: 'b' });
  assert.deepEqual(st.known, ['me', 'b']);
});

test('reduce answer merges and replays are no-ops', () => {
  const m = { playerId: 'b', q: 0, text: 'cat' };
  const once = reduce(fresh(), 'answer', m);
  assert.deepEqual(reduce(once, 'answer', m), once);
  assert.equal(once.answers.b[0], 'cat');
});

test('reduce roster accumulates the union of rosters', () => {
  let st = reduce(fresh(), 'roster', { roster: ['a', 'c'] });
  st = reduce(st, 'roster', { roster: ['a', 'b'] });
  st = reduce(st, 'roster', { roster: ['a', 'd'] });
  assert.deepEqual(st.roster, ['a', 'b', 'c', 'd']);
});

test('reduce bye drops a player from the lobby but never from a started roster', () => {
  let st = reduce(reduce(fresh(), 'hello', { playerId: 'b' }), 'bye', { playerId: 'b' });
  assert.deepEqual(st.known, ['me']);
  st = reduce(reduce(st, 'hello', { playerId: 'b' }), 'roster', { roster: ['b', 'me'] });
  assert.deepEqual(reduce(st, 'bye', { playerId: 'b' }).known, ['me', 'b']);
});

test('reduce ignores unknown message types and does not mutate', () => {
  const st = fresh();
  const snapshot = JSON.stringify(st);
  assert.deepEqual(reduce(st, 'bogus', {}), st);
  reduce(st, 'hello', { playerId: 'z' });
  assert.equal(JSON.stringify(st), snapshot);
});

test('startRoster is the sorted set of known players', () => {
  const st = reduce(reduce(fresh('m'), 'hello', { playerId: 'b' }), 'hello', { playerId: 'a' });
  assert.deepEqual(startRoster(st), ['a', 'b', 'm']);
});

test('viewKey identifies the screen so typing is not wiped by unrelated updates', () => {
  const me = 'me';
  assert.equal(viewKey(fresh(me), false), 'lobby');
  const started = { ...fresh(me), roster: ['me', 'b'] };
  assert.equal(viewKey(started, false), 'q0');
  assert.equal(viewKey({ ...started, answers: { me: ['x'] } }, false), 'q1');
  assert.equal(viewKey({ ...started, roster: ['b', 'c'] }, false), 'closed');
  assert.equal(viewKey({ ...started, answers: { me: full('me') } }, false), 'wait');
  assert.equal(viewKey({ ...started, answers: { me: full('me') } }, true), 'story');
  assert.equal(viewKey({ ...started, answers: answersFor(['me', 'b']) }, false), 'story');
});

test('slideConfirmed needs the knob dragged at least 90% of the way', () => {
  assert.equal(slideConfirmed(0, 100), false);
  assert.equal(slideConfirmed(89, 100), false);
  assert.equal(slideConfirmed(90, 100), true);
  assert.equal(slideConfirmed(100, 100), true);
});

test('slideConfirmed is false when the track has no travel', () => {
  assert.equal(slideConfirmed(0, 0), false);
  assert.equal(slideConfirmed(5, -1), false);
});

test('isConfirmKey is Shift+Enter only, so a plain Enter never submits', () => {
  assert.equal(isConfirmKey({ key: 'Enter', shiftKey: true }), true);
  assert.equal(isConfirmKey({ key: 'Enter', shiftKey: false }), false);
  assert.equal(isConfirmKey({ key: 'a', shiftKey: true }), false);
});

test('cleanAnswer trims and turns any whitespace run, including line breaks, into one space', () => {
  assert.equal(cleanAnswer('  hello \n world\r\n\t! '), 'hello world !');
  assert.equal(cleanAnswer('a\u2028b\u2029c\u00a0d'), 'a b c d');
  assert.equal(cleanAnswer('\n\n \t'), '');
  assert.equal(cleanAnswer('plain'), 'plain');
});

test('mergeAnswer stores the cleaned text and ignores blank answers', () => {
  const stored = mergeAnswer({}, 'a', 0, '  hi\nthere ');
  assert.equal(stored.a[0], 'hi there');
  const start = { a: ['x'] };
  assert.equal(mergeAnswer(start, 'a', 1, ' \n '), start);
});

test('formatStory puts each line on its own row with the first letter capitalised', () => {
  assert.equal(formatStory(['le chat', 'élan', '…', '1st', 'ça va']), 'Le chat\nÉlan\n…\n1st\nÇa va');
  assert.equal(formatStory(['iPhone']), 'IPhone');
});
