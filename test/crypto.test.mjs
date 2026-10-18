import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.split('// <crypto>')[1].split('// </crypto>')[0];
const { deriveRoom, seal, open } = new Function(code + '; return {deriveRoom, seal, open}')();

test('deriveRoom is deterministic and keeps the room code out of the topic', async () => {
  const a = await deriveRoom('abc123');
  const b = await deriveRoom('abc123');
  const c = await deriveRoom('zzz999');
  assert.equal(a.topic, b.topic);
  assert.notEqual(a.topic, c.topic);
  assert.ok(!a.topic.includes('abc123'));
});

test('seal/open round-trips objects', async () => {
  const { key } = await deriveRoom('r1');
  const msg = { type: 'answer', data: { q: 3, text: 'le chat ✓' } };
  assert.deepEqual(await open(key, await seal(key, msg)), msg);
});

test('seal output does not contain the plaintext and differs each time', async () => {
  const { key } = await deriveRoom('r1');
  const a = await seal(key, { text: 'secretanswer' });
  const b = await seal(key, { text: 'secretanswer' });
  assert.ok(!a.includes('secretanswer'));
  assert.notEqual(a, b);
});

test('open returns null for another room, garbage and tampering', async () => {
  const { key } = await deriveRoom('r1');
  const other = (await deriveRoom('r2')).key;
  const sealed = await seal(key, { x: 1 });
  assert.equal(await open(other, sealed), null);
  assert.equal(await open(key, 'not base64 at all!!'), null);
  assert.equal(await open(key, ''), null);
  const flipped = sealed.slice(0, -4) + (sealed.endsWith('AAAA') ? 'BBBB' : 'AAAA');
  assert.equal(await open(key, flipped), null);
});
