import { createRoomStore } from '../rooms.mjs';
import { createRedisClient } from '../redis-rest.mjs';

const codePattern = /^[A-Z2-9]{6}$/;

function send(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

function routeParts(req) {
  const query = new URL(req.url, 'http://localhost').searchParams;
  const value = key => req.query?.[key] ?? query.get(key);
  const route = value('route');
  if (route === 'health') return ['health'];
  if (route === 'rooms') return ['rooms', value('code'), value('action')].filter(Boolean);
  return new URL(req.url, 'http://localhost').pathname.split('/').filter(Boolean).slice(1);
}

function inputBody(req) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {};
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Richiesta non valida.');
  return body;
}

export function createVercelHandler({ redis = null, now = Date.now } = {}) {
  return async function handler(req, res) {
    const [root, codeRaw, action = ''] = routeParts(req);
    try {
      if (root === 'health' && req.method === 'GET') {
        const storage = redis ?? createRedisClient();
        if (storage.ping && !await storage.ping()) throw new Error('Storage multiplayer non disponibile.');
        return send(res, 200, { ok: true });
      }
      if (root !== 'rooms') return send(res, 404, { error: 'Pagina non trovata.' });
      const storage = redis ?? createRedisClient();
      if (!codeRaw && req.method === 'POST') {
        const input = inputBody(req);
        for (let attempt = 0; attempt < 5; attempt++) {
          const store = createRoomStore({ now, autoTimers: false });
          const { room, player } = store.create(input.name, input.settings);
          if (await storage.create(room.code, store.snapshot(room.code))) {
            return send(res, 201, { token: player.token, room: store.view(room.code, player.token) });
          }
        }
        throw new Error('Impossibile creare una stanza. Riprova.');
      }
      const code = String(codeRaw ?? '').toUpperCase();
      if (!codePattern.test(code)) return send(res, 404, { error: 'Stanza non trovata.' });
      const release = await storage.lock(code);
      try {
        const saved = await storage.get(code);
        if (!saved) throw new Error('Stanza non trovata.');
        const store = createRoomStore({ now, autoTimers: false });
        store.restore(saved);
        store.advance(code);
        let status = 200, result;
        try {
          const token = req.headers['x-player-token'] || req.query?.token || new URL(req.url, 'http://localhost').searchParams.get('token');
          if (action === 'join' && req.method === 'POST') {
            const input = inputBody(req);
            const { player } = store.join(code, input.name, input.token);
            result = { token: player.token, room: store.view(code, player.token) };
          } else if (action === 'archive' && req.method === 'GET') {
            result = store.archive(code, token);
          } else if (!action && req.method === 'GET') {
            result = { room: store.view(code, token) };
          } else if (action === 'leave' && req.method === 'POST') {
            store.leave(code, token);
            result = { ok: true };
          } else if (action === 'settings' && req.method === 'POST') {
            store.settings(code, token, inputBody(req).settings);
            result = { room: store.view(code, token) };
          } else if (action === 'start' && req.method === 'POST') {
            store.start(code, token);
            result = { room: store.view(code, token) };
          } else if (action === 'submit' && req.method === 'POST') {
            store.submit(code, token, inputBody(req).strokes);
            result = { room: store.view(code, token) };
          } else {
            status = 404;
            result = { error: 'Pagina non trovata.' };
          }
        } finally {
          await storage.save(code, store.snapshot(code));
        }
        return send(res, status, result);
      } finally {
        await release();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore imprevisto.';
      const status = /non trovata/.test(message) ? 404 : /già|scaduto|iniziata|piena/.test(message) ? 409 :
        /Storage multiplayer|Stanza occupata/.test(message) ? 503 : 400;
      return send(res, status, { error: message });
    }
  };
}

export default createVercelHandler();
