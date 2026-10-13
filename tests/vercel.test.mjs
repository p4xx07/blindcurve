import test from 'node:test';
import assert from 'node:assert/strict';
import { createVercelHandler } from '../api/room.mjs';
import { createRedisClient } from '../redis-rest.mjs';

function memoryRedis() {
  const rooms = new Map();
  return {
    async create(code, data) { if (rooms.has(code)) return false; rooms.set(code, structuredClone(data)); return true; },
    async get(code) { return structuredClone(rooms.get(code) ?? null); },
    async save(code, data) { if (data) rooms.set(code, structuredClone(data)); else rooms.delete(code); },
    async lock() { return async () => {}; }
  };
}

async function invoke(handler, path, method = 'GET', body, token) {
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); } };
  await handler({ url: path, method, body, headers: token ? { 'x-player-token': token } : {} }, response);
  return response;
}

test('independent Vercel invocations share players, timers, reveal and archive', async () => {
  let time = 100_000;
  const redis = memoryRedis();
  const one = createVercelHandler({ redis, now: () => time });
  const two = createVercelHandler({ redis, now: () => time });
  const created = await invoke(one, '/api/rooms', 'POST', { name: 'Gimble', settings: {
    seconds: 20, rounds: 1, difficultyMode: 'constant', difficulty: 'FACILE', rush: true, rushSeconds: 5
  } });
  assert.equal(created.statusCode, 201);
  const code = created.body.room.code, host = created.body.token;
  const joined = await invoke(two, `/api/rooms/${code}/join`, 'POST', { name: 'Zabi' });
  assert.equal(joined.statusCode, 200);
  const guest = joined.body.token;
  assert.equal((await invoke(one, `/api/rooms/${code}`, 'GET', undefined, guest)).body.room.players.length, 2);
  const denied = await invoke(two, `/api/rooms/${code}`);
  assert.equal(denied.statusCode, 400);
  const started = await invoke(one, `/api/rooms/${code}/start`, 'POST', {}, host);
  assert.equal(started.body.room.phase, 'drawing');
  time += 2500;
  const sent = await invoke(two, `/api/rooms/${code}/submit`, 'POST', { strokes: [] }, guest);
  assert.equal(sent.body.room.deadline, time + 5000);
  assert.equal(sent.body.room.players.find(player => player.name === 'Zabi').result, null);
  time += 5000;
  const revealed = await invoke(one, `/api/rooms/${code}`, 'GET', undefined, host);
  assert.equal(revealed.body.room.phase, 'drawing');
  time += 1000;
  const afterBuzzer = await invoke(two, `/api/rooms/${code}`, 'GET', undefined, guest);
  assert.equal(afterBuzzer.body.room.phase, 'reveal');
  assert.equal(afterBuzzer.body.room.roundDrawings.length, 2);
  time += 9000;
  const finished = await invoke(one, `/api/rooms/${code}`, 'GET', undefined, host);
  assert.equal(finished.body.room.phase, 'finished');
  const archive = await invoke(two, `/api/rooms/${code}/archive`, 'GET', undefined, guest);
  assert.equal(archive.body.history.length, 1);
});

test('Redis REST adapter sends atomic room creation and owner checked unlock', async () => {
  const commands = [];
  const request = async (_url, init) => {
    const args = JSON.parse(init.body);
    commands.push(args);
    return { ok: true, json: async () => ({ result: args[0] === 'GET' ? null : 'OK' }) };
  };
  const redis = createRedisClient({ url: 'https://example.invalid', token: 'test', request });
  assert.equal(await redis.create('ABC123', { code: 'ABC123' }), true);
  const release = await redis.lock('ABC123');
  await release();
  assert.deepEqual(commands[0].slice(0, 2), ['SET', 'blindcurve:room:ABC123']);
  assert.deepEqual(commands[0].slice(3), ['NX', 'EX', 7200]);
  assert.equal(commands[1][3], 'NX');
  assert.equal(commands[2][0], 'EVAL');
});

test('Vercel rewrite query routes to the API function', async () => {
  const redis = memoryRedis();
  const handler = createVercelHandler({ redis });
  const response = { headers: {}, setHeader(key, value) { this.headers[key] = value; },
    end(value) { this.body = JSON.parse(value); } };
  await handler({ url: '/api/room', method: 'POST', body: { name: 'Geki' }, headers: {}, query: { route: 'rooms' } }, response);
  assert.equal(response.statusCode, 201);
  const view = { headers: {}, setHeader() {}, end(value) { this.body = JSON.parse(value); } };
  await handler({ url: '/api/room', method: 'GET', headers: { 'x-player-token': response.body.token },
    query: { route: 'rooms', code: response.body.room.code } }, view);
  assert.equal(view.body.room.code, response.body.room.code);
});
