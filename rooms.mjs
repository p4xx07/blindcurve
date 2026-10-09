import { randomBytes } from 'node:crypto';
import { scoreNormalizedDrawing } from './dist/core.mjs';
import { DIFFICULTIES, generateSpecs, levelFromSpec } from './dist/generated.mjs';

export { DIFFICULTIES };
export const DEFAULT_ROUND_COUNT = 5;
const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Keep the answer blue (#326cff) reserved, and make room colors unique.
export const PLAYER_COLORS = [
  '#db573e', '#078a73', '#a148a9', '#c74378', '#8a5b24', '#438119',
  '#c43942', '#7353ae', '#008695', '#9b6900', '#60792c', '#ae406d'
];

const secret = () => randomBytes(24).toString('base64url');
const roomCode = () => Array.from(randomBytes(6), byte => ROOM_ALPHABET[byte % ROOM_ALPHABET.length]).join('');

export function validateSettings(input = {}) {
  const seconds = Number(input.seconds ?? 45);
  const rounds = Number(input.rounds ?? DEFAULT_ROUND_COUNT);
  const difficultyMode = input.difficultyMode ?? 'increasing';
  const difficulty = input.difficulty ?? 'FACILE';
  const rushSeconds = Number(input.rushSeconds ?? 10);
  if (![20, 30, 45, 60, 90].includes(seconds)) throw new Error('Scegli 20, 30, 45, 60 o 90 secondi.');
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 30) throw new Error('Scegli da 1 a 30 sfide.');
  if (!['increasing', 'constant'].includes(difficultyMode)) throw new Error('Progressione non valida.');
  if (!DIFFICULTIES.includes(difficulty)) throw new Error('Difficoltà non valida.');
  if (!Number.isInteger(rushSeconds) || rushSeconds < 3 || rushSeconds > 30) throw new Error('La finestra finale deve durare da 3 a 30 secondi.');
  return { seconds, rounds, difficultyMode, difficulty, rush: input.rush === true, rushSeconds };
}

export function makeDeck(settings, random = Math.random) {
  const count = settings.rounds ?? DEFAULT_ROUND_COUNT;
  const shortProgressions = { 1: ['FACILE'], 2: ['FACILE', 'MEDIA'],
    3: ['FACILE', 'MEDIA', 'DIFFICILE'], 4: ['FACILE', 'FACILE', 'MEDIA', 'DIFFICILE'] };
  const regular = count - 1;
  const easy = Math.max(2, Math.round(regular * .35));
  const medium = Math.max(1, Math.round(regular * .3));
  const bands = settings.difficultyMode === 'constant'
    ? Array(count).fill(settings.difficulty)
    : shortProgressions[count] ?? [
      ...Array(easy).fill('FACILE'), ...Array(medium).fill('MEDIA'),
      ...Array(regular - easy - medium).fill('DIFFICILE'), 'FOLLE'
    ];
  return generateSpecs(bands, random);
}

function cleanName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 24);
  if (!name) throw new Error('Scrivi un nome per entrare nella stanza.');
  return name;
}

export function validateStrokes(input) {
  if (!Array.isArray(input) || input.length > 30) throw new Error('Disegno non valido.');
  let count = 0;
  return input.map(stroke => {
    if (!Array.isArray(stroke)) throw new Error('Disegno non valido.');
    count += stroke.length;
    if (count > 2500) throw new Error('Disegno troppo grande.');
    return stroke.map(point => {
      const x = Number(point?.x), y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
        throw new Error('Punto fuori dal grafico.');
      }
      return { x, y };
    });
  });
}

export function createRoomStore({ now = Date.now, schedule = setTimeout, cancel = clearTimeout,
  random = () => randomBytes(4).readUInt32BE(0) / 4294967296 } = {}) {
  const rooms = new Map();
  const listeners = new Map();
  const timers = new Map();

  function emit(room) {
    const active = listeners.get(room.code);
    for (const listener of active ?? []) {
      try { listener(); } catch { active.delete(listener); }
    }
  }
  function timer(room, delay, action) {
    cancel(timers.get(room.code));
    const handle = schedule(action, delay);
    handle?.unref?.();
    timers.set(room.code, handle);
  }
  function get(code) {
    const room = rooms.get(String(code ?? '').toUpperCase());
    if (!room) throw new Error('Stanza non trovata.');
    return room;
  }
  function player(room, token) {
    const found = room.players.find(entry => entry.token === token);
    if (!found) throw new Error('Accesso alla stanza non valido.');
    return found;
  }
  function playerColor(room) {
    const available = PLAYER_COLORS.filter(color => !room.players.some(entry => entry.color === color));
    return available[Math.floor(random() * available.length)];
  }
  function create(name, settingsInput) {
    const settings = validateSettings(settingsInput);
    let code;
    do { code = roomCode(); } while (rooms.has(code));
    const host = { id: secret(), token: secret(), name: cleanName(name), color: PLAYER_COLORS[Math.floor(random() * PLAYER_COLORS.length)], total: 0 };
    const room = { code, hostId: host.id, players: [host], settings, phase: 'lobby', deck: [], history: [], roundParticipants: [], matchId: null,
      roundIndex: 0, submissions: new Map(), startsAt: null, deadline: null, originalDeadline: null, revealedAt: null,
      createdAt: now() };
    rooms.set(code, room);
    return { room, player: host };
  }
  function join(code, name, token) {
    const room = get(code);
    if (token) {
      const existing = room.players.find(entry => entry.token === token);
      if (existing) return { room, player: existing };
    }
    if (room.phase !== 'lobby') throw new Error('La partita è già iniziata.');
    if (room.players.length >= 12) throw new Error('La stanza è piena.');
    const candidate = cleanName(name);
    if (room.players.some(entry => entry.name.toLocaleLowerCase('it') === candidate.toLocaleLowerCase('it'))) {
      throw new Error('Questo nome è già in uso nella stanza.');
    }
    const joined = { id: secret(), token: secret(), name: candidate, color: playerColor(room), total: 0 };
    room.players.push(joined);
    emit(room);
    return { room, player: joined };
  }
  function leave(code, token) {
    const room = get(code), leaving = player(room, token);
    room.players = room.players.filter(entry => entry.id !== leaving.id);
    if (!room.players.length) {
      cancel(timers.get(room.code));
      timers.delete(room.code); listeners.delete(room.code); rooms.delete(room.code);
      return;
    }
    if (leaving.id === room.hostId) room.hostId = room.players[0].id;
    if (room.phase === 'drawing' && room.players.every(entry => room.submissions.has(entry.id))) reveal(room);
    emit(room);
  }
  function settings(code, token, input) {
    const room = get(code), requester = player(room, token);
    if (requester.id !== room.hostId || room.phase !== 'lobby') throw new Error('Solo chi ospita può modificare la stanza prima di iniziare.');
    room.settings = validateSettings(input);
    emit(room);
    return room;
  }
  function openRound(room) {
    room.phase = 'drawing';
    room.submissions = new Map();
    room.roundParticipants = room.players.map(({ id, name, color }) => ({ id, name, color }));
    room.startsAt = now() + 2500;
    room.deadline = room.originalDeadline = room.startsAt + room.settings.seconds * 1000;
    room.revealedAt = null;
    timer(room, room.deadline - now() + 1000, () => reveal(room));
    emit(room);
  }
  function start(code, token) {
    const room = get(code), requester = player(room, token);
    if (requester.id !== room.hostId) throw new Error('Solo chi ospita può iniziare.');
    if (!['lobby', 'finished'].includes(room.phase)) throw new Error('La partita è già iniziata.');
    room.deck = makeDeck(room.settings, random);
    room.matchId = secret();
    room.history = [];
    room.roundIndex = 0;
    for (const entry of room.players) entry.total = 0;
    openRound(room);
    return room;
  }
  function submit(code, token, rawStrokes) {
    const room = get(code), requester = player(room, token);
    if (room.phase !== 'drawing' || now() < room.startsAt || now() >= room.deadline + 1000) {
      throw new Error('Il tempo per questa sfida è scaduto.');
    }
    if (room.submissions.has(requester.id)) throw new Error('Hai già confermato il disegno.');
    const strokes = validateStrokes(rawStrokes);
    const accuracy = scoreNormalizedDrawing(levelFromSpec(room.deck[room.roundIndex]), strokes);
    const remaining = (room.originalDeadline - now()) / (room.settings.seconds * 1000);
    const speed = accuracy ? Math.max(0, Math.min(10, Math.round(10 * remaining))) : 0;
    room.submissions.set(requester.id, { strokes, accuracy, speed, points: accuracy + speed, submittedAt: now() });
    if (room.settings.rush && room.submissions.size === 1) {
      room.deadline = Math.min(room.deadline, now() + room.settings.rushSeconds * 1000);
      timer(room, room.deadline - now() + 1000, () => reveal(room));
    }
    if (room.submissions.size === room.players.length) reveal(room);
    else emit(room);
    return room;
  }
  function reveal(room) {
    if (room.phase !== 'drawing') return;
    room.phase = 'reveal';
    room.revealedAt = now();
    room.history.push({ roundIndex: room.roundIndex, levelSpec: room.deck[room.roundIndex],
      drawings: room.roundParticipants.map(entry => {
        const result = room.submissions.get(entry.id);
        return { ...entry, strokes: result?.strokes ?? [],
          result: { accuracy: result?.accuracy ?? 0, speed: result?.speed ?? 0, points: result?.points ?? 0 } };
      }) });
    for (const entry of room.players) entry.total += room.submissions.get(entry.id)?.points ?? 0;
    emit(room);
    timer(room, 9000, () => next(room));
  }
  function next(room) {
    if (room.phase !== 'reveal') return;
    if (room.roundIndex === room.deck.length - 1) {
      room.phase = 'finished';
      room.startsAt = room.deadline = null;
      emit(room);
      return;
    }
    room.roundIndex++;
    openRound(room);
  }
  function subscribe(code, token, listener) {
    const room = get(code);
    player(room, token);
    if (!listeners.has(room.code)) listeners.set(room.code, new Set());
    listeners.get(room.code).add(listener);
    return () => listeners.get(room.code)?.delete(listener);
  }
  function view(code, token) {
    const room = get(code), requester = player(room, token);
    const scoresVisible = ['reveal', 'finished'].includes(room.phase);
    const publicResult = result => result ? { accuracy: result.accuracy, speed: result.speed, points: result.points } :
      { accuracy: 0, speed: 0, points: 0 };
    return {
      code: room.code, matchId: room.matchId, phase: room.phase, settings: room.settings, serverNow: now(),
      roundIndex: room.roundIndex, roundCount: room.deck.length || room.settings.rounds,
      levelSpec: room.phase === 'lobby' ? null : room.deck[room.roundIndex],
      roundDrawings: scoresVisible ? room.history.at(-1)?.drawings ?? [] : null,
      startsAt: room.startsAt, deadline: room.deadline, revealedAt: room.revealedAt,
      you: { id: requester.id, name: requester.name, color: requester.color, isHost: requester.id === room.hostId,
        submitted: room.submissions.has(requester.id),
        result: scoresVisible ? publicResult(room.submissions.get(requester.id)) : null },
      players: room.players.map(entry => ({ id: entry.id, name: entry.name, color: entry.color, isHost: entry.id === room.hostId,
        submitted: room.submissions.has(entry.id), total: entry.total,
        result: scoresVisible ? publicResult(room.submissions.get(entry.id)) : null }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'it'))
    };
  }
  function archive(code, token) {
    const room = get(code);
    player(room, token);
    if (room.phase !== 'finished') throw new Error('I disegni si possono scaricare a partita finita.');
    return { matchId: room.matchId, history: room.history };
  }
  function sweep() {
    const cutoff = now() - 2 * 60 * 60 * 1000;
    for (const [code, room] of rooms) {
      if (room.createdAt < cutoff) {
        cancel(timers.get(code)); timers.delete(code); listeners.delete(code); rooms.delete(code);
      }
    }
  }
  return { create, join, leave, settings, start, submit, view, archive, subscribe, sweep, get, reveal };
}
