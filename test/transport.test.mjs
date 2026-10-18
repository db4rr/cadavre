import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const code = ['crypto', 'transport'].map((t) => html.split(`// <${t}>`)[1].split(`// </${t}>`)[0]).join('\n');
const { connect, connectRelay } = new Function(code + '; return {connect, connectRelay}')();

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

function fakeNet({ dead = [] } = {}) {
  const brokers = new Map();
  const wire = [];
  const mqttConnect = (url) => {
    const handlers = {};
    const subs = new Set();
    const fire = (ev, ...args) => (handlers[ev] || []).forEach((fn) => fn(...args));
    const client = {
      on(ev, fn) { (handlers[ev] ||= []).push(fn); return client; },
      subscribe(topic, opts, cb) { subs.add(topic); (cb || opts)?.(null); },
      publish(topic, payload) {
        wire.push(payload);
        for (const c of brokers.get(url)) c._deliver(topic, payload);
      },
      end() { brokers.get(url)?.delete(client); },
      _deliver(topic, payload) {
        if (subs.has(topic)) queueMicrotask(() => fire('message', topic, new TextEncoder().encode(payload)));
      },
    };
    if (dead.includes(url)) { setTimeout(() => fire('error', new Error('down')), 0); return client; }
    if (!brokers.has(url)) brokers.set(url, new Set());
    brokers.get(url).add(client);
    setTimeout(() => fire('connect'), 0);
    return client;
  };
  return { mqttConnect, wire };
}

test('relay transport: peers discover each other and exchange encrypted messages', async () => {
  const { mqttConnect, wire } = fakeNet();
  const urls = ['wss://one', 'wss://two'];
  const room = 'relay' + Math.random();
  const a = await connectRelay(room, urls, mqttConnect);
  const aSaw = once((r) => a.onPeerJoin(r));
  const b = await connectRelay(room, urls, mqttConnect);
  const bSaw = once((r) => b.onPeerJoin(r));
  const got = [];
  a.onMessage((type, data) => got.push({ type, data }));
  await Promise.all([aSaw, bSaw]);
  b.send('answer', { text: 'secretanswer' });
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(got, [{ type: 'answer', data: { text: 'secretanswer' } }]);
  assert.ok(wire.length > 0 && wire.every((p) => !p.includes('secretanswer')));
  a.close(); b.close();
});

test('relay transport: still works when one broker is down, and reports status', async () => {
  const { mqttConnect } = fakeNet({ dead: ['wss://down'] });
  const room = 'half' + Math.random();
  const a = await connectRelay(room, ['wss://down', 'wss://up'], mqttConnect);
  const statuses = [];
  a.onStatus((s) => statuses.push(s));
  const aSaw = once((r) => a.onPeerJoin(r));
  const b = await connectRelay(room, ['wss://down', 'wss://up'], mqttConnect);
  await aSaw;
  assert.deepEqual(statuses.at(-1), { up: 1, total: 2 });
  a.close(); b.close();
});

test('relay transport: rooms are isolated even on the same broker', async () => {
  const { mqttConnect } = fakeNet();
  const a = await connectRelay('ra' + Math.random(), ['wss://one'], mqttConnect);
  const b = await connectRelay('rb' + Math.random(), ['wss://one'], mqttConnect);
  let joined = false;
  a.onPeerJoin(() => (joined = true));
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(joined, false);
  a.close(); b.close();
});

test('relay transport: a leaving peer is reported', async () => {
  const { mqttConnect } = fakeNet();
  const room = 'bye' + Math.random();
  const a = await connectRelay(room, ['wss://one'], mqttConnect);
  const joined = once((r) => a.onPeerJoin(r));
  const b = await connectRelay(room, ['wss://one'], mqttConnect);
  const id = await joined;
  const left = once((r) => a.onPeerLeave(r));
  b.close();
  assert.equal(await left, id);
  a.close();
});
