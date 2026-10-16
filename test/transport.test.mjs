import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = html.split('// <transport>')[1].split('// </transport>')[0];
const { connect } = new Function(code + '; return {connect}')();

const once = (register) => new Promise((resolve) => register(resolve));

test('local transport: peers discover each other and exchange messages', async () => {
  const room = 'r' + Math.random();
  const a = await connect(room, true);
  const aSaw = once((r) => a.onPeerJoin(r));
  const b = await connect(room, true);
  const bSaw = once((r) => b.onPeerJoin(r));
  const got = once((r) => a.onMessage((type, data) => r({ type, data })));
  await Promise.all([aSaw, bSaw]);
  b.send('answer', { q: 1 });
  assert.deepEqual(await got, { type: 'answer', data: { q: 1 } });
  a.close(); b.close();
});

test('local transport: rooms are isolated', async () => {
  const a = await connect('x' + Math.random(), true);
  const b = await connect('y' + Math.random(), true);
  let joined = false;
  a.onPeerJoin(() => (joined = true));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(joined, false);
  a.close(); b.close();
});

test('local transport: peers are told when someone leaves', async () => {
  const room = 'l' + Math.random();
  const a = await connect(room, true);
  const joined = once((r) => a.onPeerJoin(r));
  const b = await connect(room, true);
  const id = await joined;
  const left = once((r) => a.onPeerLeave(r));
  b.close();
  assert.equal(await left, id);
  a.close();
});
