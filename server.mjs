import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRoomStore } from './rooms.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/core.mjs', ['core.mjs', 'text/javascript; charset=utf-8']],
  ['/generated.mjs', ['generated.mjs', 'text/javascript; charset=utf-8']],
  ['/favicon.svg', ['favicon.svg', 'image/svg+xml']]
]);

export function createAppServer({ store = createRoomStore() } = {}) {
  async function body(req) {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 150_000) throw new Error('Disegno troppo grande.');
      chunks.push(chunk);
    }
    if (!size) return {};
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('Richiesta non valida.'); }
  }
  function json(res, status, value) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(value));
  }
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true });
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        const input = await body(req);
        const { room, player } = store.create(input.name, input.settings);
        return json(res, 201, { token: player.token, room: store.view(room.code, player.token) });
      }
      const match = url.pathname.match(/^\/api\/rooms\/([A-Z2-9]{6})(?:\/(join|leave|settings|start|submit|events|archive))?$/i);
      if (match) {
        const code = match[1].toUpperCase(), action = match[2] ?? '';
        if (action === 'join' && req.method === 'POST') {
          const input = await body(req);
          const { player } = store.join(code, input.name, input.token);
          return json(res, 200, { token: player.token, room: store.view(code, player.token) });
        }
        const token = req.headers['x-player-token'] || url.searchParams.get('token');
        if (action === 'archive' && req.method === 'GET') return json(res, 200, store.archive(code, token));
        if (action === 'events' && req.method === 'GET') {
          const snapshot = () => store.view(code, token);
          snapshot();
          res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
          const send = () => res.write(`data: ${JSON.stringify(snapshot())}\n\n`);
          send();
          const unsubscribe = store.subscribe(code, token, send);
          const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000);
          req.on('close', () => { unsubscribe(); clearInterval(heartbeat); });
          return;
        }
        if (!action && req.method === 'GET') return json(res, 200, { room: store.view(code, token) });
        if (action === 'leave' && req.method === 'POST') {
          store.leave(code, token);
          return json(res, 200, { ok: true });
        }
        if (action === 'settings' && req.method === 'POST') {
          store.settings(code, token, (await body(req)).settings);
          return json(res, 200, { room: store.view(code, token) });
        }
        if (action === 'start' && req.method === 'POST') {
          store.start(code, token);
          return json(res, 200, { room: store.view(code, token) });
        }
        if (action === 'submit' && req.method === 'POST') {
          store.submit(code, token, (await body(req)).strokes);
          return json(res, 200, { room: store.view(code, token) });
        }
      }
      if (req.method === 'GET' && assets.has(url.pathname)) {
        const [file, type] = assets.get(url.pathname);
        const contents = await readFile(join(root, 'dist', file));
        res.writeHead(200, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff' });
        return res.end(contents);
      }
      json(res, 404, { error: 'Pagina non trovata.' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Errore imprevisto.';
      const status = /non trovata/.test(message) ? 404 : /già|scaduto|iniziata|piena/.test(message) ? 409 : 400;
      json(res, status, { error: message });
    }
  });
  const sweeper = setInterval(() => store.sweep(), 10 * 60 * 1000);
  server.on('close', () => clearInterval(sweeper));
  return server;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  const server = createAppServer().listen(port, '0.0.0.0', () => {
    process.stdout.write(`Curva Cieca: http://localhost:${port}\n`);
  });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
