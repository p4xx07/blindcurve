import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoomStore, makeDeck, PLAYER_COLORS, validateSettings } from '../rooms.mjs';
import { targetSamples } from '../dist/core.mjs';
import { levelFromSpec } from '../dist/generated.mjs';
import { createAppServer } from '../server.mjs';

function fakeClock() {
  let time = 0;
  const tasks = new Set();
  return {
    now: () => time,
    schedule: (fn, delay) => { const task = { at: time + delay, fn }; tasks.add(task); return task; },
    cancel: task => tasks.delete(task),
    advance(ms) {
      const end = time + ms;
      while (true) {
        const next = [...tasks].filter(task => task.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        tasks.delete(next); time = next.at; next.fn();
      }
      time = end;
    }
  };
}

test('five unique exercises exist in every fixed difficulty and the increasing deck climbs', () => {
  for (const difficulty of ['FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE']) {
    const deck = makeDeck(validateSettings({ difficultyMode: 'constant', difficulty }), () => 0);
    assert.equal(deck.length, 5);
    assert.equal(new Set(deck.map(spec => spec.family)).size, 5);
    assert.ok(deck.every(spec => spec.difficulty === difficulty));
  }
  const deck = makeDeck(validateSettings({ difficultyMode: 'increasing' }), () => 0);
  assert.deepEqual(deck.map(spec => spec.difficulty), ['FACILE', 'FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE']);
});

test('rooms accept one to thirty rounds, with a nondecreasing increasing deck', () => {
  for (const rounds of [1, 4, 5, 30]) {
    const settings = validateSettings({ rounds });
    const deck = makeDeck(settings, () => 0);
    assert.equal(deck.length, rounds);
    const order = ['FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE'];
    assert.ok(deck.every((spec, i) => i === 0 || order.indexOf(spec.difficulty) >= order.indexOf(deck[i - 1].difficulty)));
    if (rounds >= 5) assert.equal(deck.at(-1).difficulty, 'FOLLE');
  }
  assert.throws(() => validateSettings({ rounds: 0 }), /1 a 30/);
  assert.throws(() => validateSettings({ rounds: 31 }), /1 a 30/);
  assert.throws(() => validateSettings({ rounds: 2.5 }), /1 a 30/);
});

test('a room shares one deadline, shortens it after the first submission, and reveals scores together', () => {
  const clock = fakeClock();
  const store = createRoomStore({ ...clock, random: () => 0 });
  const { room, player: host } = store.create('Host', { seconds: 45, difficultyMode: 'constant', difficulty: 'FACILE', rush: true, rushSeconds: 7 });
  const { player: guest } = store.join(room.code, 'Guest');
  store.start(room.code, host.token);
  const initial = store.view(room.code, host.token);
  assert.equal(initial.deadline, 47_500);
  assert.deepEqual(initial.levelSpec, store.view(room.code, guest.token).levelSpec);
  assert.throws(() => store.submit(room.code, host.token, []), /scaduto/);
  clock.advance(2500);
  const curve = targetSamples(levelFromSpec(initial.levelSpec), 900, 500).map(point => ({ x: point.x / 900, y: point.y / 500 }));
  store.submit(room.code, host.token, [curve]);
  assert.equal(store.view(room.code, guest.token).deadline, 9500);
  assert.equal(store.view(room.code, guest.token).players.find(p => p.id === host.id).result, null);
  clock.advance(5000);
  store.submit(room.code, guest.token, []);
  assert.equal(store.view(room.code, host.token).deadline, 9500);
  const revealed = store.view(room.code, host.token);
  assert.equal(revealed.phase, 'reveal');
  assert.ok(revealed.you.result.accuracy >= 95);
  assert.equal(revealed.you.result.speed, 10);
  assert.equal(store.view(room.code, guest.token).you.result.points, 0);
  clock.advance(9000);
  assert.equal(store.view(room.code, host.token).roundIndex, 1);
  assert.equal(store.view(room.code, host.token).phase, 'drawing');
});

test('the last player submitting reveals immediately even without rush mode', () => {
  const clock = fakeClock();
  const store = createRoomStore({ ...clock, random: () => 0 });
  const { room, player: host } = store.create('Host', { seconds: 90, rush: false });
  const { player: guest } = store.join(room.code, 'Guest');
  store.start(room.code, host.token);
  clock.advance(2500);
  store.submit(room.code, host.token, []);
  assert.equal(store.view(room.code, guest.token).phase, 'drawing');
  store.submit(room.code, guest.token, []);
  assert.equal(store.view(room.code, host.token).phase, 'reveal');
  assert.equal(store.view(room.code, guest.token).you.result.points, 0);
});

test('a late first submission never extends the remaining time', () => {
  const clock = fakeClock();
  const store = createRoomStore(clock);
  const { room, player } = store.create('Host', { seconds: 20, rush: true, rushSeconds: 10 });
  store.start(room.code, player.token);
  clock.advance(20_000);
  const deadline = store.view(room.code, player.token).deadline;
  store.submit(room.code, player.token, []);
  assert.equal(store.view(room.code, player.token).deadline, deadline);
});

test('only the host can set room rules, and invalid drawings are rejected', () => {
  const clock = fakeClock();
  const store = createRoomStore(clock);
  const { room, player: host } = store.create('Host', {});
  const { player: guest } = store.join(room.code, 'Guest');
  assert.throws(() => store.settings(room.code, guest.token, { seconds: 20 }), /Solo chi ospita/);
  assert.throws(() => store.start(room.code, guest.token), /Solo chi ospita/);
  assert.throws(() => store.settings(room.code, host.token, { rushSeconds: 31 }), /3 a 30/);
  store.start(room.code, host.token);
  clock.advance(2500);
  assert.throws(() => store.submit(room.code, guest.token, [[{ x: 2, y: 0 }]]), /fuori/);
  assert.throws(() => store.submit(room.code, guest.token, Array(31).fill([])), /non valido/);
});

test('a five round room reaches a final ranking and can start a rematch', () => {
  const clock = fakeClock();
  const store = createRoomStore({ ...clock, random: () => 0 });
  const { room, player } = store.create('Host', { seconds: 20 });
  store.start(room.code, player.token);
  clock.advance(5 * (2500 + 20_000 + 1000 + 9000));
  const final = store.view(room.code, player.token);
  assert.equal(final.phase, 'finished');
  assert.equal(final.roundIndex, 4);
  assert.equal(final.players[0].total, 0);
  store.start(room.code, player.token);
  assert.equal(store.view(room.code, player.token).phase, 'drawing');
  assert.equal(store.view(room.code, player.token).roundIndex, 0);
});

test('a thirty round room completes and keeps its full archive', () => {
  const clock = fakeClock();
  const store = createRoomStore({ ...clock, random: () => 0 });
  const { room, player } = store.create('Gimble', { rounds: 30, seconds: 20, difficultyMode: 'constant', difficulty: 'MEDIA' });
  store.start(room.code, player.token);
  assert.equal(store.view(room.code, player.token).roundCount, 30);
  clock.advance(30 * (2500 + 20_000 + 1000 + 9000));
  const result = store.view(room.code, player.token);
  assert.equal(result.phase, 'finished');
  assert.equal(result.roundIndex, 29);
  assert.equal(store.archive(room.code, player.token).history.length, 30);
});

test('leaving the lobby transfers hosting to the remaining player', () => {
  const store = createRoomStore();
  const { room, player: host } = store.create('Host', {});
  const { player: guest } = store.join(room.code, 'Guest');
  store.leave(room.code, host.token);
  assert.equal(store.view(room.code, guest.token).you.isHost, true);
  store.start(room.code, guest.token);
  assert.equal(store.view(room.code, guest.token).phase, 'drawing');
});

test('room colors stay unique and drawings unlock only at reveal, then remain in the five round archive', () => {
  const clock = fakeClock();
  const store = createRoomStore({ ...clock, random: () => 0 });
  const { room, player: host } = store.create('Gimble', { seconds: 20 });
  const { player: guest } = store.join(room.code, 'Zabi');
  const { player: third } = store.join(room.code, 'Geki');
  const colors = store.view(room.code, host.token).players.map(player => player.color);
  assert.equal(new Set(colors).size, 3);
  assert.ok(colors.every(color => PLAYER_COLORS.includes(color) && color !== '#326cff'));
  store.start(room.code, host.token);
  const stroke = [[{ x: .1, y: .2 }, { x: .9, y: .8 }]];
  for (let round = 0; round < 5; round++) {
    clock.advance(2500);
    store.submit(room.code, host.token, stroke);
    const waiting = store.view(room.code, guest.token);
    assert.equal(waiting.roundDrawings, null);
    assert.equal(JSON.stringify(waiting).includes('"strokes"'), false);
    assert.throws(() => store.archive(room.code, guest.token), /partita finita/);
    store.submit(room.code, guest.token, []);
    store.submit(room.code, third.token, []);
    const revealed = store.view(room.code, guest.token);
    assert.equal(revealed.phase, 'reveal');
    assert.equal(revealed.roundDrawings.length, 3);
    assert.deepEqual(revealed.roundDrawings.find(player => player.id === host.id).strokes, stroke);
    clock.advance(9000);
  }
  assert.equal(store.view(room.code, host.token).phase, 'finished');
  const archive = store.archive(room.code, guest.token);
  assert.equal(archive.history.length, 5);
  assert.equal(archive.history[0].drawings[0].color, host.color);
  assert.deepEqual(archive.history[4].drawings[0].strokes, stroke);
  store.start(room.code, host.token);
  assert.throws(() => store.archive(room.code, host.token), /partita finita/);
});

test('HTTP server serves the game and rejects unauthenticated room reads', async () => {
  const server = createAppServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const page = await fetch(base);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Curva Cieca/);
    const translations = await fetch(`${base}/i18n.mjs`);
    assert.equal(translations.status, 200);
    assert.match(await translations.text(), /englishExplanations/);
    const created = await fetch(`${base}/api/rooms`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Host', settings: { seconds: 20 } }) });
    assert.equal(created.status, 201);
    const { token, room } = await created.json();
    const denied = await fetch(`${base}/api/rooms/${room.code}`);
    assert.equal(denied.status, 400);
    const allowed = await fetch(`${base}/api/rooms/${room.code}`, { headers: { 'X-Player-Token': token } });
    assert.equal(allowed.status, 200);
    assert.equal((await allowed.json()).room.code, room.code);
    const deniedArchive = await fetch(`${base}/api/rooms/${room.code}/archive`);
    assert.equal(deniedArchive.status, 400);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
