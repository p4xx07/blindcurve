import { randomUUID } from 'node:crypto';

const ROOM_TTL_SECONDS = 2 * 60 * 60;
const LOCK_TTL_MS = 20_000;
const RELEASE_LOCK = 'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';

export function createRedisClient({ url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,
  request = fetch } = {}) {
  if (!url || !token) throw new Error('Storage multiplayer non configurato: collega Upstash Redis a Vercel.');
  async function command(...args) {
    const response = await request(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`Storage multiplayer non disponibile (${response.status}).`);
    const body = await response.json();
    if (body.error) throw new Error(`Storage multiplayer: ${body.error}`);
    return body.result;
  }
  const roomKey = code => `blindcurve:room:${code}`;
  return {
    async ping() { return (await command('PING')) === 'PONG'; },
    async create(code, room) {
      return (await command('SET', roomKey(code), JSON.stringify(room), 'NX', 'EX', ROOM_TTL_SECONDS)) === 'OK';
    },
    async get(code) {
      const value = await command('GET', roomKey(code));
      return value === null ? null : JSON.parse(value);
    },
    async save(code, room) {
      if (room) await command('SET', roomKey(code), JSON.stringify(room), 'EX', ROOM_TTL_SECONDS);
      else await command('DEL', roomKey(code));
    },
    async lock(code) {
      const key = `${roomKey(code)}:lock`;
      const owner = randomUUID();
      const until = Date.now() + 4000;
      do {
        if (await command('SET', key, owner, 'NX', 'PX', LOCK_TTL_MS) === 'OK') {
          return async () => { await command('EVAL', RELEASE_LOCK, 1, key, owner); };
        }
        await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 60));
      } while (Date.now() < until);
      throw new Error('Stanza occupata, riprova tra un istante.');
    }
  };
}
