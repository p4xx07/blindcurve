import { WORLD, pixelToWorld, worldToPixel, scoreNormalizedDrawing } from './core.mjs';
import { explanationForSpec, generateSpecs, levelFromSpec } from './generated.mjs';
import { difficultyNames, englishExplanations, levelText } from './i18n.mjs';
import { piTicks } from './axis.mjs';

const $ = id => document.getElementById(id);
const canvas = $('graphCanvas');
const ctx = canvas.getContext('2d');
const wrap = $('canvasWrap');
const difficultyOrder = ['FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE'];
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
let locale = localStorage.getItem('curvaLocale') || 'it';
const tr = (italian, english) => locale === 'en' ? english : italian;
const levelName = level => levelText(level.spec, locale)?.name ?? level.name;
const levelPrompt = level => levelText(level.spec, locale)?.prompt ?? level.prompt;
const difficultyName = difficulty => difficultyNames[locale][difficulty];
const staticTranslations = [
  ['.challenge-panel h1', 'First<br>imagine.<br><em>Then draw.</em>', 'html'],
  ['.intro', 'The formula is all you get. Draw the curve you expect, then reveal the answer.', 'text'],
  ['.picker-label', 'HOW DO YOU WANT TO PLAY?', 'text'],
  ['#journeyMode', '↗ Journey', 'text'], ['#practiceMode', '◎ Practice', 'text'], ['#roomMode', '◉ Room', 'text'],
  ['.difficulty-option[data-difficulty=FACILE]', 'Easy', 'text'], ['.difficulty-option[data-difficulty=MEDIA]', 'Medium', 'text'],
  ['.difficulty-option[data-difficulty=DIFFICILE]', 'Hard', 'text'], ['.difficulty-option[data-difficulty=FOLLE]', 'Wild', 'text'],
  ['#createRoomForm h2', 'Create a room', 'text'], ['#joinRoomForm h2', 'Join with a code', 'text'],
  ['#createRoomForm label:has(#hostName)', 'Your name', 'node'], ['#joinRoomForm label:has(#joinName)', 'Your name', 'node'],
  ['#joinRoomForm label:has(#joinCode)', 'Code', 'node'],
  ['#createRoomForm label:has(#createRounds)', 'Number of rounds', 'node'],
  ['#createRoomForm label:has(#createSeconds)', 'Seconds per round', 'node'],
  ['#createRoomForm label:has(#createMode)', 'Progression', 'node'],
  ['#roomLobbySettings label:has(#roomRounds)', 'Number of rounds', 'node'],
  ['#roomLobbySettings label:has(#roomSeconds)', 'Seconds', 'node'],
  ['#roomLobbySettings label:has(#roomDifficultyMode)', 'Progression', 'node'],
  ['#createDifficultyWrap>span', 'Difficulty', 'text'], ['#roomDifficultyWrap>span', 'Difficulty', 'text'],
  ['#createRush', 'Shorten the timer after the first submission', 'parentNode'],
  ['#roomRush', 'Shorten the timer after the first submission', 'parentNode'],
  ['#createRoomForm label:has(#createRushSeconds)', 'Seconds after the first submission', 'node'],
  ['#roomLobbySettings label:has(#roomRushSeconds)', 'Final window (seconds)', 'node'],
  ['#createRoomForm button[type=submit]', 'Create room ↗', 'text'], ['#joinRoomForm button[type=submit]', 'Join room →', 'text'],
  ['#saveRoomBtn', 'Save settings', 'text'], ['#leaveRoomBtn', 'Leave', 'text'],
  ['#copyRoomBtn', 'Copy link', 'text'], ['.micro-tip span:last-child', 'You can draw several strokes. Leave gaps at asymptotes.', 'text'],
  ['#roomCode', 'ROOM ', 'parentNode'], ['#countdownCard span', 'GET READY', 'text'],
  ['#waitingCard', 'Drawing sent · the answer appears when everyone submits or time runs out', 'text'],
  ['.graph-top-label span:last-child', 'DRAW HERE ↘', 'text'],
  ['.legend span:first-child', 'YOUR DRAWING', 'node'], ['.legend span:last-child', 'ANSWER', 'node'],
  ['#drawingControls .drawing-controls-head span', 'Answer in blue', 'text'],
  ['#downloadDrawingBtn', 'Download PNG ↓', 'text'], ['.score-label', 'YOUR SCORE', 'text'],
  ['#undoBtn', '↶ Undo', 'text'], ['#clearBtn', '⌫ Clear', 'text'], ['#retryBtn', '↻ Try again', 'text'],
  ['#skipBtn', 'Skip →', 'text'], ['#explanationPanel summary', 'How do you recognize this curve?', 'text'],
  ['#createMode option[value=increasing]', 'Increasing', 'text'], ['#createMode option[value=constant]', 'Constant', 'text'],
  ['#roomDifficultyMode option[value=increasing]', 'Increasing', 'text'], ['#roomDifficultyMode option[value=constant]', 'Constant', 'text'],
  ...['create','room'].flatMap(prefix => ['FACILE','MEDIA','DIFFICILE','FOLLE'].map((difficulty, index) =>
    [`#${prefix}DifficultyWrap button[data-difficulty=${difficulty}]`, ['Easy','Medium','Hard','Wild'][index], 'text']))
];
function applyStaticLanguage() {
  document.documentElement.lang = locale;
  document.title = tr('Curva Cieca — Indovina il grafico', 'Curva Cieca — Guess the graph');
  document.querySelector('meta[name=description]').content = tr('Guarda una funzione, immagina la sua curva e prova a disegnarla. Poi scopri quanto ci sei andato vicino.', 'See a function, imagine its curve, and draw your guess. Then reveal the answer.');
  $('languageButton').textContent = locale === 'it' ? 'EN' : 'IT';
  $('languageButton').setAttribute('aria-label', locale === 'it' ? 'Switch to English' : 'Passa all’italiano');
  $('hostName').placeholder = $('joinName').placeholder = tr('Il tuo nome', 'Your name');
  canvas.setAttribute('aria-label', tr('Piano cartesiano. Disegna il grafico con il mouse o con il dito.', 'Coordinate plane. Draw the graph with your mouse or finger.'));
  $('archiveRounds').setAttribute('aria-label', tr('Scegli la sfida da rivedere', 'Choose a round to review'));
  $('drawingToggles').setAttribute('aria-label', tr('Giocatori visibili', 'Visible players'));
  for (const [selector, english, kind] of staticTranslations) {
    const element = document.querySelector(selector);
    if (!element) continue;
    const node = kind === 'parentNode' ? [...element.parentNode.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim())
      : kind === 'node' ? [...element.childNodes].find(child => child.nodeType === Node.TEXT_NODE && child.textContent.trim()) : null;
    const target = node ?? element;
    const property = kind === 'html' ? 'innerHTML' : 'textContent';
    if (target._italianText === undefined) target._italianText = target[property];
    target[property] = locale === 'en' ? english : target._italianText;
  }
}
const sillyNames = [
  'gimble', 'zabi', 'geki', 'plofi', 'bimzo', 'wibbi', 'snurli', 'kobu',
  'zompi', 'pibbo', 'fuzli', 'grimbi', 'tibzi', 'moki', 'blorbi', 'niblo',
  'vexi', 'pugli', 'jombo', 'quibi', 'drombi', 'zunki', 'pebbi', 'guffi',
  'borki', 'grizi', 'skibi', 'wompa', 'fippo', 'gloobi', 'tazbi', 'klembo',
  'rumbi', 'wexi', 'bloofi', 'jibzi', 'pombi', 'glurbi', 'frimzi', 'mibzi',
  'zuddi', 'flimbo', 'nuxi', 'brubbi', 'kiblo', 'wiggi', 'sproki', 'yumbi',
  'druki', 'blozo', 'zwibi', 'nimbi', 'gobzi', 'rulbo', 'wumzi', 'pribbi',
  'glimzo', 'folbi', 'plumbi', 'mibbo', 'krofi', 'squibi', 'trumzi', 'bexi',
  'ziblo', 'frubu', 'grumbo', 'puzli', 'wobzi', 'nibzi', 'tukki', 'bublo',
  'grembi', 'zofli', 'pibzi', 'krumbo', 'fuzbo', 'weki', 'blumbi', 'juffi',
  'snibbo', 'qumzi', 'drimzi', 'gubli', 'plekki', 'wumpo', 'zibbi', 'frongli'
];
const suggestedName = sillyNames[Math.floor(random() * sillyNames.length)];
$('hostName').value = suggestedName;
$('joinName').value = suggestedName;
const state = {
  mode: 'journey', difficulty: 'FACILE', levelIndex: 0, strokes: [], drawing: false,
  revealed: false, revealing: false, revealX: 0, width: 0, height: 0,
  scores: new Map(), soloDeck: [], currentLevel: null, animationId: 0, roomSession: null, room: null,
  roomEvents: null, roomPollTimer: 0, roomSubmitting: false, roomRoundKey: '', clockOffset: 0,
  roomResultShown: false, roomAutoSent: false, roomBoard: new Map(), roomBoardSignature: '',
  visiblePlayers: new Set(), archiveRoundIndex: 0, archive: null, archiveLoading: false,
  axisMode: 'numbers', activePointerId: null
};

function setAxisMode(mode) {
  state.axisMode = mode;
  const button = $('axisModeButton');
  button.textContent = mode === 'pi' ? 'X: π' : tr('X: numeri', 'X: numbers');
  button.setAttribute('aria-pressed', String(mode === 'pi'));
  button.setAttribute('aria-label', mode === 'pi'
    ? tr('Asse X in radianti. Passa ai numeri.', 'X axis in radians. Switch to numbers.')
    : tr('Asse X con numeri. Passa ai radianti.', 'X axis with numbers. Switch to radians.'));
  render();
}

function defaultAxisMode(level) {
  return level?.piAxis ? 'pi' : 'numbers';
}

function indicesForMode() {
  return state.soloDeck.map((_, i) => i);
}

function formatIndex(n) { return String(n + 1).padStart(2, '0'); }

function setMode(mode) {
  const enteringRoom = state.mode !== 'room' && mode === 'room';
  if (state.mode === 'room' && mode !== 'room' && state.roomSession) leaveRoom();
  state.mode = mode;
  $('journeyMode').classList.toggle('active', mode === 'journey');
  $('practiceMode').classList.toggle('active', mode === 'practice');
  $('roomMode').classList.toggle('active', mode === 'room');
  $('journeyMode').setAttribute('aria-pressed', String(mode === 'journey'));
  $('practiceMode').setAttribute('aria-pressed', String(mode === 'practice'));
  $('roomMode').setAttribute('aria-pressed', String(mode === 'room'));
  $('difficultyPicker').hidden = mode !== 'practice';
  $('roomPanel').hidden = mode !== 'room';
  $('timerStrip').hidden = mode !== 'room' || !state.room || state.room.phase === 'lobby';
  if (mode !== 'room') $('drawingControls').hidden = true;
  document.querySelector('.side-bottom').hidden = mode === 'room';
  $('modeDescription').textContent = mode === 'journey'
    ? tr('20 curve nuove a ogni percorso, da facile a folle.', '20 new curves each journey, from easy to wild.') : mode === 'practice'
      ? tr('Scegli una difficoltà: ogni giro porta curve nuove.', 'Pick a difficulty. Every run brings new curves.')
      : tr('Da 1 a 30 curve, stesso timer, un vincitore.', '1 to 30 curves, one timer, one winner.');
  $('progressTitle').textContent = mode === 'journey' ? tr('IL TUO PERCORSO', 'YOUR JOURNEY') : tr('SFIDE DI QUESTA DIFFICOLTÀ', 'ROUNDS AT THIS LEVEL');
  document.querySelectorAll('.difficulty-option').forEach(button => {
    const active = button.dataset.difficulty === state.difficulty;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (mode === 'room') {
    if (enteringRoom) {
      cancelAnimationFrame(state.animationId);
      state.strokes = [];
      state.revealed = false;
      state.revealing = false;
      state.currentLevel = null;
      $('scoreCard').hidden = true;
      $('explanationPanel').hidden = true;
    }
    $('challengeHud').hidden = !state.room || state.room.phase === 'lobby';
    $('playBtn').hidden = true; $('nextBtn').hidden = true; $('retryBtn').hidden = true; $('skipBtn').hidden = true;
    $('playKicker').textContent = tr('PARTITA IN STANZA', 'ROOM MATCH');
    $('playHeading').textContent = state.room ? tr('Aspetta la prossima curva', 'Waiting for the next curve') : tr('Crea una stanza o entra', 'Create or join a room');
    $('graphHint').classList.remove('hide');
    $('graphHint').lastElementChild.innerHTML = tr('La sfida apparirà qui<br />quando inizia la partita.', 'The round will appear here<br />when the match starts.');
    updateButtons(); render();
  } else {
    const bands = mode === 'journey' ? difficultyOrder.flatMap(difficulty => Array(5).fill(difficulty))
      : Array(5).fill(state.difficulty);
    state.soloDeck = generateSpecs(bands, random).map(levelFromSpec);
    state.scores = new Map();
    $('playKicker').textContent = tr('IL TUO FOGLIO', 'YOUR CANVAS');
    $('playHeading').textContent = tr('Come sarà la curva?', 'What will the curve look like?');
    $('challengeHud').hidden = false;
    $('graphHint').lastElementChild.innerHTML = tr('Traccia la curva<br />con il dito o il mouse.', 'Draw the curve<br />with your finger or mouse.');
    selectLevel(indicesForMode()[0]);
  }
}

function selectLevel(index, roomLevel = null) {
  cancelAnimationFrame(state.animationId);
  state.levelIndex = index;
  state.strokes = [];
  state.drawing = false;
  state.revealed = false;
  state.revealing = false;
  state.revealX = 0;
  const level = roomLevel ?? state.soloDeck[index];
  state.currentLevel = level;
  setAxisMode(defaultAxisMode(level));
  const list = state.mode === 'room' ? Array.from({ length: state.room?.roundCount ?? 5 }, (_, i) => i) : indicesForMode();
  const position = list.indexOf(index);
  $('challengeNumber').textContent = state.mode === 'room' ? formatIndex(state.room?.roundIndex ?? 0) : formatIndex(position);
  $('challengeTotal').textContent = formatIndex(list.length - 1);
  $('progressLabel').textContent = `${formatIndex(position)} / ${formatIndex(list.length - 1)}`;
  $('roundLabel').textContent = `${tr('SFIDA', 'ROUND')} ${position + 1} / ${list.length}`;
  $('levelName').textContent = levelName(level);
  $('difficulty').textContent = difficultyName(level.difficulty);
  $('difficulty').dataset.level = level.difficulty;
  $('formula').innerHTML = level.formula;
  $('levelPrompt').textContent = tr('Indovina la forma: guarda svolte, rami e oscillazioni.', 'Guess the shape: look for turns, branches and waves.');
  $('graphHint').classList.remove('hide');
  $('scoreCard').hidden = true;
  $('drawingControls').hidden = true;
  $('explanationPanel').hidden = true;
  $('explanationPanel').open = false;
  $('playBtn').hidden = state.mode === 'room' && (!state.room || state.room.phase !== 'drawing');
  $('nextBtn').hidden = true;
  $('retryBtn').hidden = true;
  $('skipBtn').hidden = state.mode === 'room';
  $('statusText').textContent = `${formatIndex(position)} — ${tr('DISEGNA LA TUA IPOTESI', 'DRAW YOUR GUESS')}`;
  updateButtons();
  if (state.mode !== 'room') renderDots();
  render();
}

function renderDots() {
  const list = indicesForMode();
  $('levelDots').style.gridTemplateColumns = `repeat(${list.length}, 1fr)`;
  $('levelDots').replaceChildren(...list.map((index, position) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'level-dot';
    if (index === state.levelIndex) button.classList.add('current');
    else if (state.scores.has(index)) button.classList.add('completed');
    button.title = `${formatIndex(position)} · ${levelName(state.soloDeck[index])}${state.scores.has(index) ? ` · ${state.scores.get(index)}/100` : ''}`;
    button.setAttribute('aria-label', button.title);
    button.addEventListener('click', () => selectLevel(index));
    return button;
  }));
}

function updateButtons() {
  const hasDrawing = state.strokes.some(stroke => stroke.length > 1);
  const roomLocked = state.mode === 'room' && (!state.room || state.room.phase !== 'drawing' ||
    state.room.you.submitted || state.roomSubmitting || Date.now() + state.clockOffset < state.room.startsAt ||
    Date.now() + state.clockOffset >= state.room.deadline);
  $('undoBtn').disabled = !state.strokes.length || state.revealing || state.revealed || roomLocked;
  $('clearBtn').disabled = !state.strokes.length || state.revealing || state.revealed || roomLocked;
  $('playBtn').disabled = !hasDrawing || state.revealing || state.revealed || roomLocked;
}

function resizeCanvas() {
  const rect = wrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  state.width = rect.width;
  state.height = rect.height;
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}

function gridLine(context, x1, y1, x2, y2, color, lineWidth = 1) {
  context.beginPath();context.moveTo(x1, y1);context.lineTo(x2, y2);
  context.strokeStyle = color;context.lineWidth = lineWidth;context.stroke();
}

function renderGrid(context = ctx, width = state.width, height = state.height) {
  context.fillStyle = '#f7f8f3';context.fillRect(0, 0, width, height);
  if (state.axisMode === 'pi') {
    for (let quarter = -6; quarter <= 6; quarter++) {
      const x = quarter * Math.PI / 4;
      if (x <= WORLD.xmin || x >= WORLD.xmax) continue;
      const px = worldToPixel(x, 0, width, height).x;
      gridLine(context, px, 0, px, height, quarter % 2 === 0 ? '#dce3e5' : '#e9edef');
    }
  } else {
    for (let x = WORLD.xmin; x <= WORLD.xmax; x += .5) {
      const px = worldToPixel(x, 0, width, height).x;
      gridLine(context, px, 0, px, height, Number.isInteger(x) ? '#dce3e5' : '#e9edef');
    }
  }
  for (let y = WORLD.ymin; y <= WORLD.ymax; y += .5) {
    const py = worldToPixel(0, y, width, height).y;
    gridLine(context, 0, py, width, py, Number.isInteger(y) ? '#dce3e5' : '#e9edef');
  }
  const zero = worldToPixel(0, 0, width, height);
  gridLine(context, zero.x, 0, zero.x, height, '#8290a0', 1.6);
  gridLine(context, 0, zero.y, width, zero.y, '#8290a0', 1.6);
  context.font = '10px DM Mono, monospace';context.fillStyle = '#8b99a8';
  context.textAlign = 'center';
  if (state.axisMode === 'pi') {
    for (const tick of piTicks()) context.fillText(tick.label, worldToPixel(tick.x, 0, width, height).x, zero.y + 16);
  } else {
    for (const x of [-4,-2,2,4]) context.fillText(String(x), worldToPixel(x, 0, width, height).x, zero.y + 16);
  }
  context.textAlign = 'right';
  for (const y of [-3,-2,-1,1,2,3]) context.fillText(String(y), zero.x - 8, worldToPixel(0, y, width, height).y + 3);
  context.fillStyle = '#607084';context.fillText('0', zero.x - 7, zero.y + 16);
}

function visibleRound() {
  if (state.mode !== 'room' || !state.room) return null;
  return state.room.phase === 'finished' ? state.archive?.[state.archiveRoundIndex] ??
    { levelSpec: state.room.levelSpec, drawings: state.room.roundDrawings } :
    state.room.phase === 'reveal' ? { levelSpec: state.room.levelSpec, drawings: state.room.roundDrawings } : null;
}

function renderDrawing(context = ctx, width = state.width, height = state.height, drawings = null) {
  const shown = drawings ?? (visibleRound()?.drawings?.filter(player => state.visiblePlayers.has(player.id)) ??
    [{ strokes: state.strokes, color: state.mode === 'room' ? state.room?.you.color : '#f36e50' }]);
  context.save();context.lineWidth = width >= 800 ? 5 : 4;context.lineJoin = 'round';context.lineCap = 'round';
  for (const player of shown) for (const stroke of player.strokes) {
    if (!stroke.length) continue;
    const first = { x: stroke[0].x * width, y: stroke[0].y * height };
    context.beginPath();context.moveTo(first.x, first.y);
    for (let i = 1; i < stroke.length; i++) context.lineTo(stroke[i].x * width, stroke[i].y * height);
    if (stroke.length === 1) context.lineTo(first.x + .1, first.y + .1);
    context.strokeStyle = player.color;
    context.shadowColor = `${player.color}55`;context.shadowBlur = 4;
    context.stroke();
  }
  context.restore();
}

function crossesBreak(a, b, breaks = []) { return breaks.some(value => a < value && b >= value); }

function renderTarget(limit, context = ctx, width = state.width, height = state.height, level = state.currentLevel) {
  context.save();context.strokeStyle = '#326cff';context.lineWidth = 3.2;context.lineJoin = 'round';context.lineCap = 'round';
  context.shadowColor = '#326cff33';context.shadowBlur = 4;
  context.beginPath();let previous = null;
  for (let px = 0; px <= Math.min(limit, width); px += 2) {
    const x = pixelToWorld(px, 0, width, height).x;
    const y = level.fn(x);
    const visible = Number.isFinite(y) && y >= WORLD.ymin && y <= WORLD.ymax;
    const py = worldToPixel(x, y, width, height).y;
    if (!visible || (previous && (crossesBreak(previous.x, x, level.breaks) || Math.abs(py - previous.py) > height * .28))) {
      previous = null;
      if (!visible) continue;
    }
    if (!previous) context.moveTo(px, py); else context.lineTo(px, py);
    previous = { x, py };
  }
  context.stroke();context.restore();
}

function render() {
  if (!state.width || !state.height) return;
  renderGrid();renderDrawing();
  if (state.revealed || state.revealing) {
    renderTarget(state.revealed ? state.width : state.revealX);
    if (state.revealing) {
      const x = state.revealX;
      const gradient = ctx.createLinearGradient(x - 35, 0, x + 3, 0);
      gradient.addColorStop(0, '#326cff00');gradient.addColorStop(1, '#326cff20');
      ctx.fillStyle = gradient;ctx.fillRect(Math.max(0, x - 35), 0, 38, state.height);
      gridLine(ctx, x, 0, x, state.height, '#326cff88', 1.5);
    }
  }
}

function renderDrawingControls() {
  const room = state.room;
  const round = visibleRound();
  if (!round || !room || (room.phase === 'finished' && !state.archive)) { $('drawingControls').hidden = true; return; }
  $('drawingControls').hidden = false;
  const finished = room.phase === 'finished';
  $('drawingControlsTitle').textContent = finished ? tr('Rivedi e scarica una sfida', 'Review and download a round') : tr('I disegni della stanza', 'Room drawings');
  $('archiveRounds').hidden = !finished;
  $('downloadDrawingBtn').hidden = !finished;
  if (finished) {
    $('archiveRounds').replaceChildren(...state.archive.map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === state.archiveRoundIndex ? 'active' : '';
      button.textContent = `${tr('Sfida', 'Round')} ${index + 1}`;
      button.setAttribute('aria-pressed', String(index === state.archiveRoundIndex));
      button.addEventListener('click', () => selectArchiveRound(index));
      return button;
    }));
    $('downloadDrawingBtn').textContent = `${tr('Scarica sfida', 'Download round')} ${state.archiveRoundIndex + 1} · PNG ↓`;
  }
  $('drawingToggles').replaceChildren(...round.drawings.map(player => {
    const label = document.createElement('label'); label.className = 'drawing-toggle';
    label.style.setProperty('--player-color', player.color);
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.visiblePlayers.has(player.id);
    input.setAttribute('aria-label', `${tr('Mostra il disegno di', 'Show the drawing by')} ${player.name}`);
    input.addEventListener('change', () => {
      if (input.checked) state.visiblePlayers.add(player.id); else state.visiblePlayers.delete(player.id);
      render();
    });
    const swatch = document.createElement('span'); swatch.className = 'toggle-swatch';
    const name = document.createElement('span'); name.textContent = `${player.name}${player.id === room.you.id ? tr(' · tu', ' · you') : ''}${player.strokes.length ? '' : tr(' · nessun tratto', ' · no strokes')}`;
    label.append(input, swatch, name);
    return label;
  }));
}

function selectArchiveRound(index) {
  const round = state.archive?.[index];
  if (!round) return;
  state.archiveRoundIndex = index;
  state.visiblePlayers = new Set(round.drawings.map(player => player.id));
  state.currentLevel = levelFromSpec(round.levelSpec);
  setAxisMode(defaultAxisMode(state.currentLevel));
  state.revealed = true; state.revealing = false;
  $('roundLabel').textContent = `${tr('SFIDA', 'ROUND')} ${index + 1} / ${state.room.roundCount}`;
  $('levelName').textContent = levelName(state.currentLevel);
  $('difficulty').textContent = difficultyName(state.currentLevel.difficulty);
  $('difficulty').dataset.level = state.currentLevel.difficulty;
  $('formula').innerHTML = state.currentLevel.formula;
  renderDrawingControls();
  showRoomResult(false);
}

function plainFormula(html) {
  const element = document.createElement('div');
  element.innerHTML = html.replace(/<br\s*\/?\s*>/gi, ' · ');
  const superscript = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻', '-': '⁻', '+': '⁺', '(': '⁽', ')': '⁾' };
  for (const sup of element.querySelectorAll('sup')) {
    sup.replaceWith([...sup.textContent].map(character => superscript[character] ?? character).join(''));
  }
  return element.textContent.replace(/\s+/g, ' ').trim();
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > maxWidth && lines < maxLines - 1) {
      context.fillText(line, x, y + lines * lineHeight); lines++; line = word;
    } else line = next;
  }
  context.fillText(line, x, y + lines * lineHeight);
}

function downloadRoundImage() {
  const round = visibleRound();
  if (state.room?.phase !== 'finished' || !round) return;
  const level = levelFromSpec(round.levelSpec);
  const selected = round.drawings.filter(player => state.visiblePlayers.has(player.id));
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '600 18px Space Grotesk, sans-serif';
  let legendX = 250, legendRows = 1;
  for (const player of selected) {
    const itemWidth = Math.max(115, probe.measureText(player.name).width + 35);
    if (legendX + itemWidth > 1120) { legendX = 80; legendRows++; }
    legendX += itemWidth;
  }
  const image = document.createElement('canvas'); image.width = 1200;
  image.height = Math.max(1230, 1121 + (legendRows - 1) * 39 + 75);
  const context = image.getContext('2d');
  context.fillStyle = '#111521'; context.fillRect(0, 0, image.width, image.height);
  context.textAlign = 'left'; context.fillStyle = '#dcfa77'; context.font = '600 22px Space Grotesk, sans-serif';
  context.fillText(`CURVA CIECA  ·  ${tr('SFIDA', 'ROUND')} ${state.archiveRoundIndex + 1} / ${state.room.roundCount}  ·  ${levelName(level).toUpperCase()}`, 78, 60);
  context.fillStyle = '#f5f3ed'; context.font = '700 33px Space Grotesk, sans-serif';
  drawWrappedText(context, plainFormula(level.formula), 78, 110, 1044, 40);
  context.fillStyle = '#f7f8f3'; context.fillRect(78, 230, 1044, 844);
  context.save(); context.translate(100, 252);
  renderGrid(context, 1000, 800);
  renderDrawing(context, 1000, 800, selected);
  renderTarget(1000, context, 1000, 800, level);
  context.restore();
  context.fillStyle = '#a9b5c7'; context.font = '500 16px DM Mono, monospace';
  context.fillText(tr('SOLUZIONE', 'ANSWER'), 80, 1121);
  context.fillStyle = '#326cff'; context.fillRect(194, 1111, 28, 5);
  let x = 250, y = 1121;
  for (const player of selected) {
    context.font = '600 18px Space Grotesk, sans-serif';
    const itemWidth = Math.max(115, context.measureText(player.name).width + 35);
    if (x + itemWidth > 1120) { x = 80; y += 39; }
    context.fillStyle = player.color; context.fillRect(x, y - 11, 20, 5);
    context.fillStyle = '#f5f3ed'; context.fillText(player.name, x + 29, y);
    x += itemWidth;
  }
  image.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = `curva-cieca-${state.room.code}-sfida-${state.archiveRoundIndex + 1}.png`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }, 'image/png');
}

$('downloadDrawingBtn').addEventListener('click', downloadRoundImage);

function pointerPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) };
}

function pointerInsideCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right &&
    event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function stopDrawing(event) {
  if (event && event.pointerId !== state.activePointerId) return;
  const pointerId = state.activePointerId;
  state.drawing = false;
  state.activePointerId = null;
  if (pointerId !== null && canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
  updateButtons();
}

canvas.addEventListener('pointerdown', event => {
  if (state.drawing || state.revealed || state.revealing || (state.mode === 'room' &&
    (!state.room || state.room.phase !== 'drawing' || state.room.you.submitted || state.roomSubmitting ||
      Date.now() + state.clockOffset < state.room.startsAt || Date.now() + state.clockOffset >= state.room.deadline))) return;
  event.preventDefault();canvas.setPointerCapture(event.pointerId);
  state.drawing = true;state.activePointerId = event.pointerId;state.strokes.push([pointerPoint(event)]);
  $('graphHint').classList.add('hide');updateButtons();render();
});
canvas.addEventListener('pointermove', event => {
  if (!state.drawing || event.pointerId !== state.activePointerId) return;
  if (!pointerInsideCanvas(event)) { stopDrawing(event); return; }
  event.preventDefault();
  const stroke = state.strokes.at(-1);
  const point = pointerPoint(event);
  const last = stroke.at(-1);
  if (Math.hypot((point.x - last.x) * state.width, (point.y - last.y) * state.height) >= 1.5) {
    stroke.push(point);updateButtons();render();
  }
});
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);
canvas.addEventListener('pointerleave', stopDrawing);
canvas.addEventListener('lostpointercapture', stopDrawing);
window.addEventListener('blur', () => stopDrawing());

$('undoBtn').addEventListener('click', () => {
  state.strokes.pop();
  if (!state.strokes.length) $('graphHint').classList.remove('hide');
  updateButtons();render();
});
$('clearBtn').addEventListener('click', () => {
  state.strokes = []; $('graphHint').classList.remove('hide');updateButtons();render();
});

$('playBtn').addEventListener('click', () => {
  if (state.mode === 'room') { submitRoom(); return; }
  if (state.revealing || state.revealed || !state.strokes.length) return;
  state.revealing = true;state.drawing = false;updateButtons();
  $('statusText').textContent = tr('LA CURVA PRENDE FORMA…', 'THE CURVE IS APPEARING…');
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 2200;
  const start = performance.now();
  const step = now => {
    const progress = Math.min(1, (now - start) / duration);
    state.revealX = state.width * progress;
    render();
    if (progress < 1) state.animationId = requestAnimationFrame(step);
    else finishReveal();
  };
  state.animationId = requestAnimationFrame(step);
});

function soloVerdict(score) {
  return score >= 85 ? [tr('Visione matematica', 'Curve nailed'), tr('La curva era già nella tua testa.', 'You had the shape in mind.')]
    : score >= 65 ? [tr('Ci sei quasi', 'Almost there'), tr('La forma c’è. Qualche tratto ti è sfuggito.', 'The shape is close; a few parts slipped away.')]
    : score >= 40 ? [tr('Buon intuito', 'Some good instincts'), tr('Hai colto qualcosa: confronta i due tratti.', 'You caught part of it. Compare the two lines.')]
    : [tr('Riprova a immaginarla', 'Try picturing it again'), tr('Ora guarda dove la formula cambia direzione.', 'Look for where the formula changes direction.')];
}

function finishReveal() {
  state.revealing = false;state.revealed = true;render();
  const score = scoreNormalizedDrawing(state.currentLevel, state.strokes);
  state.scores.set(state.levelIndex, Math.max(score, state.scores.get(state.levelIndex) || 0));
  $('scoreNumber').textContent = String(score);
  const verdict = soloVerdict(score);
  $('scoreTitle').textContent = verdict[0];$('scoreDescription').textContent = verdict[1];
  $('levelPrompt').textContent = levelPrompt(state.currentLevel);
  $('scoreBreakdown').hidden = true;
  $('scoreCard').hidden = false;
  showExplanation();
  reactToScore(score);
  $('statusText').textContent = `${tr('RISULTATO', 'RESULT')} · ${score}/100`;
  $('playBtn').hidden = true;$('nextBtn').hidden = false;
  $('retryBtn').hidden = false;
  $('skipBtn').hidden = true;
  $('nextBtn').textContent = state.levelIndex === state.soloDeck.length - 1
    ? state.mode === 'journey' ? tr('Nuovo percorso ↗', 'New journey ↗') : tr('Altre curve ↗', 'More curves ↗') : tr('Prossima sfida →', 'Next round →');
  renderDots();
}

function reactToScore(score) {
  const frame = document.querySelector('.graph-frame');
  frame.classList.remove('hit', 'miss');
  void frame.offsetWidth;
  frame.classList.add(score >= 85 ? 'hit' : score < 35 ? 'miss' : 'hit');
  if (score >= 85 && navigator.vibrate) navigator.vibrate(30);
}

function showExplanation() {
  const spec = state.currentLevel.spec;
  $('explanationText').textContent = locale === 'en'
    ? englishExplanations[spec.difficulty][spec.family] : explanationForSpec(spec);
  $('explanationPanel').hidden = false;
}

$('nextBtn').addEventListener('click', () => {
  const list = indicesForMode();
  if (state.levelIndex === list.at(-1)) setMode(state.mode);
  else selectLevel(state.levelIndex + 1);
});
$('skipBtn').addEventListener('click', () => {
  const list = indicesForMode();
  if (state.levelIndex === list.at(-1)) setMode(state.mode);
  else selectLevel(state.levelIndex + 1);
});
$('retryBtn').addEventListener('click', () => selectLevel(state.levelIndex));
$('journeyMode').addEventListener('click', () => setMode('journey'));
$('practiceMode').addEventListener('click', () => setMode('practice'));
$('roomMode').addEventListener('click', () => setMode('room'));
document.querySelectorAll('.difficulty-option').forEach(button => button.addEventListener('click', () => {
  state.difficulty = button.dataset.difficulty;
  setMode('practice');
}));

function showRoomError(message) {
  const englishErrors = {
    'Accesso alla stanza non valido.': 'Invalid room access.',
    'Difficoltà non valida.': 'Invalid difficulty.',
    'Disegno non valido.': 'Invalid drawing.',
    'Disegno troppo grande.': 'Drawing is too large.',
    'Hai già confermato il disegno.': 'You already submitted your drawing.',
    'I disegni si possono scaricare a partita finita.': 'Drawings can be downloaded after the match.',
    'Il tempo per questa sfida è scaduto.': 'Time is up for this round.',
    'La finestra finale deve durare da 3 a 30 secondi.': 'The final window must be 3 to 30 seconds.',
    'La partita è già iniziata.': 'The match has already started.',
    'La stanza è piena.': 'The room is full.',
    'Progressione non valida.': 'Invalid progression.',
    'Punto fuori dal grafico.': 'Point is outside the graph.',
    'Questo nome è già in uso nella stanza.': 'That name is already in use in this room.',
    'Scegli 20, 30, 45, 60 o 90 secondi.': 'Choose 20, 30, 45, 60 or 90 seconds.',
    'Scegli da 1 a 30 sfide.': 'Choose 1 to 30 rounds.',
    'Scrivi un nome per entrare nella stanza.': 'Enter a name to join the room.',
    'Solo chi ospita può iniziare.': 'Only the host can start the match.',
    'Solo chi ospita può modificare la stanza prima di iniziare.': 'Only the host can change room settings before the match.',
    'Stanza non trovata.': 'Room not found.',
    'Richiesta non valida.': 'Invalid request.'
  };
  $('roomError').textContent = locale === 'en' ? englishErrors[message] ?? message : message;
  $('roomError').hidden = !message;
}

async function roomRequest(path, method = 'GET', data, token = state.roomSession?.token) {
  const response = await fetch(path, { method, headers: {
    ...(data ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'X-Player-Token': token } : {})
  }, body: data ? JSON.stringify(data) : undefined });
  const result = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : { error: tr('Per giocare in stanza serve il server Node. Avvia con npm start.', 'Room play needs the Node server. Start it with npm start.') };
  if (!response.ok) throw new Error(result.error || tr('Connessione non riuscita.', 'Connection failed.'));
  return result;
}

function readRoomSettings(prefix) {
  return {
    rounds: Number($(`${prefix}Rounds`).value),
    seconds: Number($(prefix === 'create' ? 'createSeconds' : 'roomSeconds').value),
    difficultyMode: $(prefix === 'create' ? 'createMode' : 'roomDifficultyMode').value,
    difficulty: $(`${prefix}Difficulty`).value,
    rush: $(`${prefix}Rush`).checked,
    rushSeconds: Number($(`${prefix}RushSeconds`).value)
  };
}

function updateSettingVisibility(prefix) {
  $(prefix === 'create' ? 'createDifficultyWrap' : 'roomDifficultyWrap').hidden =
    $(prefix === 'create' ? 'createMode' : 'roomDifficultyMode').value !== 'constant';
  $(`${prefix}RushSecondsWrap`).hidden = !$(`${prefix}Rush`).checked;
  for (const button of $(`${prefix}DifficultyWrap`).querySelectorAll('button[data-difficulty]')) {
    const selected = button.dataset.difficulty === $(`${prefix}Difficulty`).value;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  }
}
for (const prefix of ['create', 'room']) {
  $(prefix === 'create' ? 'createMode' : 'roomDifficultyMode').addEventListener('change', () => updateSettingVisibility(prefix));
  $(`${prefix}Rush`).addEventListener('change', () => updateSettingVisibility(prefix));
  $(`${prefix}DifficultyWrap`).addEventListener('click', event => {
    const button = event.target.closest('button[data-difficulty]');
    if (!button) return;
    $(`${prefix}Difficulty`).value = button.dataset.difficulty;
    updateSettingVisibility(prefix);
  });
}
updateSettingVisibility('create');
updateSettingVisibility('room');

function connectRoom(code, token, snapshot) {
  state.roomEvents?.close();
  clearTimeout(state.roomPollTimer);
  state.roomSession = { code, token };
  state.roomBoard = new Map();
  state.roomBoardSignature = '';
  sessionStorage.setItem('curvaRoom', JSON.stringify(state.roomSession));
  const url = new URL(location.href);
  url.searchParams.set('room', code);
  history.replaceState(null, '', url);
  setMode('room');
  applyRoomSnapshot(snapshot);
  const poll = async () => {
    if (state.roomSession?.code !== code || state.roomSession?.token !== token) return;
    try {
      const result = await roomRequest(`/api/rooms/${code}`, 'GET', undefined, token);
      if (state.roomSession?.code === code && state.roomSession?.token === token) {
        showRoomError(''); applyRoomSnapshot(result.room);
      }
    } catch { showRoomError(tr('Connessione interrotta. Riconnessione in corso…', 'Connection lost. Reconnecting…')); }
    if (state.roomSession?.code === code && state.roomSession?.token === token) state.roomPollTimer = setTimeout(poll, 1000);
  };
  state.roomPollTimer = setTimeout(poll, 1000);
}

function leaveRoom() {
  if (state.roomSession) {
    fetch(`/api/rooms/${state.roomSession.code}/leave`, { method: 'POST',
      headers: { 'X-Player-Token': state.roomSession.token }, keepalive: true }).catch(() => {});
  }
  document.body.classList.remove('in-room');
  document.body.style.removeProperty('--own-color');
  state.roomEvents?.close();
  clearTimeout(state.roomPollTimer);
  state.roomEvents = null;
  state.roomPollTimer = 0;
  state.roomSession = null;
  state.room = null;
  state.roomBoard = new Map();
  state.roomBoardSignature = '';
  state.roomRoundKey = '';
  state.roomSubmitting = false;
  state.roomAutoSent = false;
  state.visiblePlayers = new Set();
  state.archiveRoundIndex = 0;
  state.archive = null;
  state.archiveLoading = false;
  sessionStorage.removeItem('curvaRoom');
  const url = new URL(location.href);
  url.searchParams.delete('room');
  history.replaceState(null, '', url);
  $('roomEntry').hidden = false;
  $('roomActive').hidden = true;
  $('timerStrip').hidden = true;
  $('countdownCard').hidden = true;
  $('waitingCard').hidden = true;
  $('drawingControls').hidden = true;
  showRoomError('');
}

function syncLobbySettings(settings) {
  const signature = JSON.stringify(settings);
  if (signature === state.settingsSignature) return;
  state.settingsSignature = signature;
  $('roomRounds').value = String(settings.rounds);
  $('roomSeconds').value = String(settings.seconds);
  $('roomDifficultyMode').value = settings.difficultyMode;
  $('roomDifficulty').value = settings.difficulty;
  $('roomRush').checked = settings.rush;
  $('roomRushSeconds').value = String(settings.rushSeconds);
  updateSettingVisibility('room');
}

function renderRoomPlayers(room) {
  const signature = JSON.stringify([room.phase, room.players.map(player => [player.id, player.color, player.total, player.submitted, player.isHost])]);
  if (signature === state.roomBoardSignature) return;
  state.roomBoardSignature = signature;
  const previous = state.roomBoard;
  const animate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rows = room.players.map((player, index) => {
    const row = document.createElement('div');
    row.className = `room-player${index === 0 && room.phase !== 'lobby' ? ' room-leader' : ''}`;
    const rank = document.createElement('span'); rank.className = 'room-player-rank'; rank.textContent = `${index + 1}.`;
    const swatch = document.createElement('span'); swatch.className = 'room-player-swatch'; swatch.style.setProperty('--player-color', player.color);
    const name = document.createElement('span'); name.className = 'room-player-name';
    name.textContent = `${player.name}${player.isHost ? ' ★' : ''}`;
    if (player.id === room.you.id) name.classList.add('room-player-you');
    const meta = document.createElement('span'); meta.className = 'room-player-meta';
    meta.textContent = room.phase === 'lobby' ? tr('PRONTO', 'READY') : room.phase === 'drawing'
      ? player.submitted ? tr('INVIATO ✓', 'SENT ✓') : tr('DISEGNA…', 'DRAWING…')
      : room.phase === 'finished' ? `${player.total} PT` : `+${player.result.points} · ${player.total} PT`;
    row.append(rank, swatch, name, meta);
    const before = previous.get(player.id);
    if (animate && room.phase === 'reveal' && before && (player.total > before.total || index !== before.rank)) {
      requestAnimationFrame(() => {
        if (!row.isConnected) return;
        const travel = Math.max(-180, Math.min(180, (before.rank - index) * 42));
        row.animate([
          { transform: `translateY(${travel}px) scale(.94)`, opacity: .7 },
          { transform: `translateY(${travel >= 0 ? -7 : 7}px) scale(1.03)`, opacity: 1, offset: .78 },
          { transform: 'translateY(0) scale(1)', opacity: 1 }
        ], { duration: 680, easing: 'cubic-bezier(.18,.8,.22,1)' });
        if (index === 0 && player.total > before.total) name.animate([
          { transform: 'translateX(0)', color: '#dcfa77' },
          { transform: 'translateX(-3px)', color: '#fff' },
          { transform: 'translateX(3px)', color: '#dcfa77' },
          { transform: 'translateX(-2px)', color: '#fff' },
          { transform: 'translateX(0)', color: '#dcfa77' }
        ], { duration: 500, delay: 300 });
      });
    }
    return row;
  });
  $('roomPlayers').replaceChildren(...rows);
  state.roomBoard = new Map(room.players.map((player, rank) => [player.id, { rank, total: player.total }]));
}

function renderRoomUI() {
  const room = state.room;
  if (!room) return;
  $('roomEntry').hidden = true;
  $('roomActive').hidden = false;
  $('roomPanel').dataset.phase = room.phase;
  document.body.classList.add('in-room');
  $('roomCode').textContent = room.code;
  document.body.style.setProperty('--own-color', room.you.color);
  $('roomLobbySettings').hidden = room.phase !== 'lobby' || !room.you.isHost;
  $('startRoomBtn').hidden = !room.you.isHost || !['lobby', 'finished'].includes(room.phase);
  $('startRoomBtn').textContent = room.phase === 'finished' ? tr('Nuova partita ↗', 'New match ↗')
    : `${tr('Inizia', 'Start')} ${room.settings.rounds} ${room.settings.rounds === 1 ? tr('sfida', 'round') : tr('sfide', 'rounds')} ↗`;
  $('roomMessage').textContent = room.phase === 'lobby'
    ? `${room.players.length} ${room.players.length === 1 ? tr('giocatore', 'player') : tr('giocatori', 'players')} · ${room.settings.rounds} ${room.settings.rounds === 1 ? tr('sfida', 'round') : tr('sfide', 'rounds')} · ${room.settings.seconds} ${tr('s per curva', 's per curve')} · ${room.settings.difficultyMode === 'constant' ? `${difficultyName(room.settings.difficulty).toLowerCase()} ${tr('costante', 'throughout')}` : tr('difficoltà crescente', 'increasing difficulty')}${room.settings.rush ? ` · ${room.settings.rushSeconds} ${tr('s dopo il primo invio', 's after first submission')}` : ''}`
    : room.phase === 'drawing' ? `${room.players.filter(player => player.submitted).length}/${room.players.length} ${tr('disegni inviati · la soluzione appare quando tutti confermano o allo scadere.', 'drawings sent · the answer appears when everyone submits or time runs out.')}`
    : room.phase === 'reveal' ? tr('Confronta i tratti. La prossima curva arriva tra pochi secondi.', 'Compare the drawings. The next curve is coming soon.')
    : `🏆 ${room.players[0]?.name ?? tr('Nessuno', 'Nobody')} · ${room.players[0]?.total ?? 0} ${tr('punti', 'points')}. ${room.you.isHost ? tr('Puoi avviare una rivincita.', 'You can start a rematch.') : tr('Aspetta una rivincita.', 'Wait for a rematch.')}`;
  if (room.phase === 'lobby') syncLobbySettings(room.settings);
  renderRoomPlayers(room);
  $('challengeHud').hidden = room.phase === 'lobby';
  $('timerStrip').hidden = room.phase !== 'drawing';
  $('timerText').hidden = room.phase !== 'drawing';
  $('roundLabel').textContent = `${tr('SFIDA', 'ROUND')} ${room.phase === 'finished' && state.archive ? state.archiveRoundIndex + 1 : room.roundIndex + 1} / ${room.roundCount}`;
  $('playHeading').textContent = room.phase === 'lobby' ? tr('Aspetta chi ospita', 'Waiting for the host') : room.phase === 'finished' ? tr('Partita finita!', 'Match over!') : tr('Come sarà la curva?', 'What will the curve look like?');
  $('playBtn').hidden = room.phase !== 'drawing' || room.you.submitted || state.roomSubmitting;
  $('nextBtn').hidden = true; $('retryBtn').hidden = true; $('skipBtn').hidden = true;
  $('playLabel').textContent = tr('Conferma disegno', 'Submit drawing');
  $('waitingCard').hidden = room.phase !== 'drawing' || !room.you.submitted;
  if (room.phase === 'drawing') $('statusText').textContent = room.you.submitted ? tr('DISEGNO INVIATO · ASPETTA', 'DRAWING SENT · WAIT') : tr('DISEGNA PRIMA CHE SCADA IL TEMPO', 'DRAW BEFORE TIME RUNS OUT');
  if (room.phase === 'lobby') {
    $('graphHint').classList.remove('hide');
    $('graphHint').lastElementChild.innerHTML = tr('La sfida apparirà qui<br />quando inizia la partita.', 'The round will appear here<br />when the match starts.');
  }
  if (room.phase === 'finished') $('statusText').textContent = tr('PARTITA COMPLETATA', 'MATCH COMPLETE');
  updateButtons();
}

function applyRoomSnapshot(room) {
  if (state.room?.code === room.code && room.serverNow < state.room.serverNow) return;
  state.clockOffset = room.serverNow - Date.now();
  const previous = state.room;
  if (previous?.matchId !== room.matchId) {
    state.archive = null;
    state.archiveLoading = false;
    state.archiveRoundIndex = 0;
  }
  state.room = room;
  const key = `${room.code}:${room.roundIndex}:${room.startsAt}`;
  if (room.phase !== 'lobby' && room.levelSpec && key !== state.roomRoundKey) {
    state.roomRoundKey = key;
    state.roomResultShown = false;
    state.roomSubmitting = false;
    state.roomAutoSent = false;
    selectLevel(room.roundIndex, levelFromSpec(room.levelSpec));
    $('graphHint').lastElementChild.innerHTML = tr('Traccia la curva<br />con il dito o il mouse.', 'Draw the curve<br />with your finger or mouse.');
  }
  if (room.phase === 'reveal' && previous?.phase !== 'reveal') {
    state.visiblePlayers = new Set(room.roundDrawings.map(player => player.id));
    renderDrawingControls();
    if (!state.roomResultShown) revealRoom();
  }
  if (room.phase === 'finished' && previous?.phase !== 'finished') {
    state.visiblePlayers = new Set(room.roundDrawings.map(player => player.id));
    state.revealing = false; state.revealed = true;
    showRoomResult(false);
  }
  if (room.phase === 'finished' && !state.archive && !state.archiveLoading) loadArchive(room);
  renderRoomUI();
  tickRoomClock();
}

async function loadArchive(room) {
  state.archiveLoading = true;
  try {
    const result = await roomRequest(`/api/rooms/${room.code}/archive`);
    if (state.room?.matchId !== result.matchId || state.room?.phase !== 'finished') return;
    state.archive = result.history;
    selectArchiveRound(result.history.length - 1);
  } catch (error) { showRoomError(error.message); }
  finally { state.archiveLoading = false; }
}

function revealRoom() {
  state.revealing = true;
  state.drawing = false;
  $('graphHint').classList.add('hide');
  $('waitingCard').hidden = true;
  $('countdownCard').hidden = true;
  const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 250 : 1800;
  const started = performance.now();
  const step = now => {
    const progress = Math.min(1, (now - started) / duration);
    state.revealX = state.width * progress;
    render();
    if (progress < 1) state.animationId = requestAnimationFrame(step);
    else showRoomResult();
  };
  state.animationId = requestAnimationFrame(step);
}

function showRoomResult(animate = true) {
  if (!state.room || (state.roomResultShown && animate)) return;
  state.roomResultShown = true;
  state.revealing = false;
  state.revealed = true;
  $('graphHint').classList.add('hide');
  render();
  const { accuracy, speed, points } = visibleRound()?.drawings?.find(player => player.id === state.room.you.id)?.result ??
    { accuracy: 0, speed: 0, points: 0 };
  $('scoreNumber').textContent = String(accuracy);
  $('scoreTitle').textContent = accuracy >= 85 ? tr('Curva centrata!', 'Curve nailed!') : accuracy >= 60 ? tr('Buona intuizione', 'Good intuition') : accuracy >= 30 ? tr('Qualche svolta giusta', 'Some turns matched') : tr('Curva sfuggita', 'Curve missed');
  $('scoreDescription').textContent = levelPrompt(state.currentLevel);
  $('scoreBreakdown').textContent = `${accuracy} ${tr('forma', 'shape')} + ${speed} ${tr('velocità', 'speed')} = ${points} ${tr('punti', 'points')}`;
  $('scoreBreakdown').hidden = false;
  $('scoreCard').hidden = false;
  showExplanation();
  $('levelPrompt').textContent = levelPrompt(state.currentLevel);
  $('statusText').textContent = `${tr('RISULTATO', 'RESULT')} · ${points} ${tr('PUNTI', 'POINTS')}`;
  if (animate) reactToScore(accuracy);
  updateButtons();
}

async function submitRoom() {
  const room = state.room;
  if (!room || room.phase !== 'drawing' || room.you.submitted || state.roomSubmitting) return;
  if (Date.now() + state.clockOffset < room.startsAt) return;
  state.roomSubmitting = true;
  state.drawing = false;
  updateButtons();
  try {
    const result = await roomRequest(`/api/rooms/${room.code}/submit`, 'POST', { strokes: state.strokes });
    applyRoomSnapshot(result.room);
    if (navigator.vibrate) navigator.vibrate(15);
  } catch (error) {
    state.roomSubmitting = false;
    showRoomError(error.message);
    updateButtons();
  }
}

function tickRoomClock() {
  const room = state.room;
  if (state.mode !== 'room' || !room || room.phase !== 'drawing') return;
  const current = Date.now() + state.clockOffset;
  const beforeStart = room.phase === 'drawing' && current < room.startsAt;
  $('countdownCard').hidden = !beforeStart;
  $('graphHint').classList.toggle('hide', beforeStart || state.strokes.length > 0 || room.you.submitted);
  if (beforeStart) $('countdownNumber').textContent = String(Math.max(1, Math.ceil((room.startsAt - current) / 1000)));
  const remaining = Math.max(0, Math.min(room.settings.seconds, (room.deadline - current) / 1000));
  $('timerText').textContent = `${Math.ceil(remaining)} s`;
  const total = room.settings.seconds;
  $('timerFill').style.width = `${Math.max(0, Math.min(100, remaining / total * 100))}%`;
  $('timerStrip').classList.toggle('urgent', remaining <= Math.min(10, room.settings.rushSeconds));
  if (room.phase === 'drawing' && !beforeStart && remaining <= 0 && !room.you.submitted && !state.roomSubmitting && !state.roomAutoSent) {
    state.roomAutoSent = true;
    submitRoom();
  }
  updateButtons();
}

$('createRoomForm').addEventListener('submit', async event => {
  event.preventDefault(); showRoomError('');
  try {
    const result = await roomRequest('/api/rooms', 'POST', { name: $('hostName').value, settings: readRoomSettings('create') }, null);
    connectRoom(result.room.code, result.token, result.room);
  } catch (error) { showRoomError(error.message); }
});
$('joinRoomForm').addEventListener('submit', async event => {
  event.preventDefault(); showRoomError('');
  const code = $('joinCode').value.trim().toUpperCase();
  try {
    const result = await roomRequest(`/api/rooms/${encodeURIComponent(code)}/join`, 'POST', { name: $('joinName').value }, null);
    connectRoom(result.room.code, result.token, result.room);
  } catch (error) { showRoomError(error.message); }
});
$('saveRoomBtn').addEventListener('click', async () => {
  try {
    const result = await roomRequest(`/api/rooms/${state.room.code}/settings`, 'POST', { settings: readRoomSettings('room') });
    applyRoomSnapshot(result.room); showRoomError('');
  } catch (error) { showRoomError(error.message); }
});
$('startRoomBtn').addEventListener('click', async () => {
  try {
    const result = await roomRequest(`/api/rooms/${state.room.code}/start`, 'POST', {});
    applyRoomSnapshot(result.room); showRoomError('');
  } catch (error) { showRoomError(error.message); }
});
$('copyRoomBtn').addEventListener('click', async () => {
  const url = new URL(location.href);
  url.searchParams.set('room', state.room.code);
  try { await navigator.clipboard.writeText(url.toString()); $('copyRoomBtn').textContent = tr('Link copiato ✓', 'Link copied ✓'); }
  catch { $('copyRoomBtn').textContent = tr('Copia non riuscita', 'Copy failed'); }
  setTimeout(() => { $('copyRoomBtn').textContent = tr('Copia link', 'Copy link'); }, 2200);
});
$('leaveRoomBtn').addEventListener('click', () => { leaveRoom(); setMode('journey'); });

function refreshLanguage() {
  applyStaticLanguage();
  setAxisMode(state.axisMode);
  $('modeDescription').textContent = state.mode === 'journey'
    ? tr('20 curve nuove a ogni percorso, da facile a folle.', '20 new curves each journey, from easy to wild.')
    : state.mode === 'practice' ? tr('Scegli una difficoltà: ogni giro porta curve nuove.', 'Pick a difficulty. Every run brings new curves.')
      : tr('Da 1 a 30 curve, stesso timer, un vincitore.', '1 to 30 curves, one timer, one winner.');
  $('progressTitle').textContent = state.mode === 'journey' ? tr('IL TUO PERCORSO', 'YOUR JOURNEY') : tr('SFIDE DI QUESTA DIFFICOLTÀ', 'ROUNDS AT THIS LEVEL');
  $('playKicker').textContent = state.mode === 'room' ? tr('PARTITA IN STANZA', 'ROOM MATCH') : tr('IL TUO FOGLIO', 'YOUR CANVAS');
  if (state.currentLevel) {
    $('levelName').textContent = levelName(state.currentLevel);
    $('difficulty').textContent = difficultyName(state.currentLevel.difficulty);
    $('levelPrompt').textContent = state.revealed ? levelPrompt(state.currentLevel) : tr('Indovina la forma: guarda svolte, rami e oscillazioni.', 'Guess the shape: look for turns, branches and waves.');
    if (!state.revealed) $('graphHint').lastElementChild.innerHTML = tr('Traccia la curva<br />con il dito o il mouse.', 'Draw the curve<br />with your finger or mouse.');
    if (!$('explanationPanel').hidden) showExplanation();
  }
  if (state.mode === 'room') {
    if (state.room) {
      state.roomBoardSignature = '';
      renderRoomUI();
      if (state.revealed && ['reveal', 'finished'].includes(state.room.phase)) {
        renderDrawingControls();
        showRoomResult(false);
      }
    } else {
      $('playHeading').textContent = tr('Crea una stanza o entra', 'Create or join a room');
      $('graphHint').lastElementChild.innerHTML = tr('La sfida apparirà qui<br />quando inizia la partita.', 'The round will appear here<br />when the match starts.');
    }
    return;
  }
  $('playHeading').textContent = tr('Come sarà la curva?', 'What will the curve look like?');
  $('roundLabel').textContent = `${tr('SFIDA', 'ROUND')} ${state.levelIndex + 1} / ${state.soloDeck.length}`;
  $('playLabel').textContent = tr('Scopri la curva', 'Reveal curve');
  if (state.revealed) {
    const score = Number($('scoreNumber').textContent);
    const verdict = soloVerdict(score);
    $('scoreTitle').textContent = verdict[0]; $('scoreDescription').textContent = verdict[1];
    $('statusText').textContent = `${tr('RISULTATO', 'RESULT')} · ${score}/100`;
    $('nextBtn').textContent = state.levelIndex === state.soloDeck.length - 1
      ? state.mode === 'journey' ? tr('Nuovo percorso ↗', 'New journey ↗') : tr('Altre curve ↗', 'More curves ↗')
      : tr('Prossima sfida →', 'Next round →');
  } else $('statusText').textContent = `${formatIndex(state.levelIndex)} — ${tr('DISEGNA LA TUA IPOTESI', 'DRAW YOUR GUESS')}`;
  renderDots();
}

$('languageButton').addEventListener('click', () => {
  locale = locale === 'it' ? 'en' : 'it';
  localStorage.setItem('curvaLocale', locale);
  refreshLanguage();
});

$('axisModeButton').addEventListener('click', () => setAxisMode(state.axisMode === 'pi' ? 'numbers' : 'pi'));

setInterval(tickRoomClock, 100);

new ResizeObserver(resizeCanvas).observe(wrap);
applyStaticLanguage();
setMode('journey');
const roomFromUrl = new URL(location.href).searchParams.get('room')?.toUpperCase();
if (roomFromUrl) {
  setMode('room');
  $('joinCode').value = roomFromUrl;
  try {
    const saved = JSON.parse(sessionStorage.getItem('curvaRoom') || 'null');
    if (saved?.code === roomFromUrl) {
      const result = await roomRequest(`/api/rooms/${roomFromUrl}`, 'GET', undefined, saved.token);
      connectRoom(roomFromUrl, saved.token, result.room);
    }
  } catch { sessionStorage.removeItem('curvaRoom'); }
}
