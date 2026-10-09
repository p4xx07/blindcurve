import { WORLD, pixelToWorld, worldToPixel, scoreNormalizedDrawing } from './core.mjs';
import { explanationForSpec, generateSpecs, levelFromSpec } from './generated.mjs';

const $ = id => document.getElementById(id);
const canvas = $('graphCanvas');
const ctx = canvas.getContext('2d');
const wrap = $('canvasWrap');
const difficultyOrder = ['FACILE', 'MEDIA', 'DIFFICILE', 'FOLLE'];
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
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
  visiblePlayers: new Set(), archiveRoundIndex: 0, archive: null, archiveLoading: false
};

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
    ? '20 curve nuove a ogni percorso, da facile a folle.' : mode === 'practice'
      ? 'Scegli una difficoltà: ogni giro porta curve nuove.'
      : 'Da 1 a 30 curve, stesso timer, un vincitore.';
  $('progressTitle').textContent = mode === 'journey' ? 'IL TUO PERCORSO' : 'SFIDE DI QUESTA DIFFICOLTÀ';
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
    $('playKicker').textContent = 'PARTITA IN STANZA';
    $('playHeading').textContent = state.room ? 'Aspetta la prossima curva' : 'Crea una stanza o entra';
    $('graphHint').classList.remove('hide');
    $('graphHint').lastElementChild.innerHTML = 'La sfida apparirà qui<br />quando inizia la partita.';
    updateButtons(); render();
  } else {
    const bands = mode === 'journey' ? difficultyOrder.flatMap(difficulty => Array(5).fill(difficulty))
      : Array(5).fill(state.difficulty);
    state.soloDeck = generateSpecs(bands, random).map(levelFromSpec);
    state.scores = new Map();
    $('playKicker').textContent = 'IL TUO FOGLIO';
    $('playHeading').textContent = 'Come sarà la curva?';
    $('challengeHud').hidden = false;
    $('graphHint').lastElementChild.innerHTML = 'Traccia la curva<br />con il dito o il mouse.';
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
  const list = state.mode === 'room' ? Array.from({ length: state.room?.roundCount ?? 5 }, (_, i) => i) : indicesForMode();
  const position = list.indexOf(index);
  $('challengeNumber').textContent = state.mode === 'room' ? formatIndex(state.room?.roundIndex ?? 0) : formatIndex(position);
  $('challengeTotal').textContent = formatIndex(list.length - 1);
  $('progressLabel').textContent = `${formatIndex(position)} / ${formatIndex(list.length - 1)}`;
  $('roundLabel').textContent = `SFIDA ${position + 1} / ${list.length}`;
  $('levelName').textContent = level.name;
  $('difficulty').textContent = level.difficulty;
  $('difficulty').dataset.level = level.difficulty;
  $('formula').innerHTML = level.formula;
  $('levelPrompt').textContent = 'Indovina la forma: guarda svolte, rami e oscillazioni.';
  $('graphHint').classList.remove('hide');
  $('scoreCard').hidden = true;
  $('drawingControls').hidden = true;
  $('explanationPanel').hidden = true;
  $('explanationPanel').open = false;
  $('playBtn').hidden = state.mode === 'room' && (!state.room || state.room.phase !== 'drawing');
  $('nextBtn').hidden = true;
  $('retryBtn').hidden = true;
  $('skipBtn').hidden = state.mode === 'room';
  $('statusText').textContent = `${formatIndex(position)} — DISEGNA LA TUA IPOTESI`;
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
    button.title = `${formatIndex(position)} · ${state.soloDeck[index].name}${state.scores.has(index) ? ` · ${state.scores.get(index)}/100` : ''}`;
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
  for (let x = WORLD.xmin; x <= WORLD.xmax; x += .5) {
    const px = worldToPixel(x, 0, width, height).x;
    gridLine(context, px, 0, px, height, Number.isInteger(x) ? '#dce3e5' : '#e9edef');
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
  for (const x of [-4,-2,2,4]) context.fillText(String(x), worldToPixel(x, 0, width, height).x, zero.y + 16);
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
  $('drawingControlsTitle').textContent = finished ? 'Rivedi e scarica una sfida' : 'I disegni della stanza';
  $('archiveRounds').hidden = !finished;
  $('downloadDrawingBtn').hidden = !finished;
  if (finished) {
    $('archiveRounds').replaceChildren(...state.archive.map((entry, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = index === state.archiveRoundIndex ? 'active' : '';
      button.textContent = `Sfida ${index + 1}`;
      button.setAttribute('aria-pressed', String(index === state.archiveRoundIndex));
      button.addEventListener('click', () => selectArchiveRound(index));
      return button;
    }));
    $('downloadDrawingBtn').textContent = `Scarica sfida ${state.archiveRoundIndex + 1} · PNG ↓`;
  }
  $('drawingToggles').replaceChildren(...round.drawings.map(player => {
    const label = document.createElement('label'); label.className = 'drawing-toggle';
    label.style.setProperty('--player-color', player.color);
    const input = document.createElement('input'); input.type = 'checkbox'; input.checked = state.visiblePlayers.has(player.id);
    input.setAttribute('aria-label', `Mostra il disegno di ${player.name}`);
    input.addEventListener('change', () => {
      if (input.checked) state.visiblePlayers.add(player.id); else state.visiblePlayers.delete(player.id);
      render();
    });
    const swatch = document.createElement('span'); swatch.className = 'toggle-swatch';
    const name = document.createElement('span'); name.textContent = `${player.name}${player.id === room.you.id ? ' · tu' : ''}${player.strokes.length ? '' : ' · nessun tratto'}`;
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
  state.revealed = true; state.revealing = false;
  $('roundLabel').textContent = `SFIDA ${index + 1} / ${state.room.roundCount}`;
  $('levelName').textContent = state.currentLevel.name;
  $('difficulty').textContent = state.currentLevel.difficulty;
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
  context.fillText(`CURVA CIECA  ·  SFIDA ${state.archiveRoundIndex + 1} / ${state.room.roundCount}  ·  ${level.name.toUpperCase()}`, 78, 60);
  context.fillStyle = '#f5f3ed'; context.font = '700 33px Space Grotesk, sans-serif';
  drawWrappedText(context, plainFormula(level.formula), 78, 110, 1044, 40);
  context.fillStyle = '#f7f8f3'; context.fillRect(78, 230, 1044, 844);
  context.save(); context.translate(100, 252);
  renderGrid(context, 1000, 800);
  renderDrawing(context, 1000, 800, selected);
  renderTarget(1000, context, 1000, 800, level);
  context.restore();
  context.fillStyle = '#a9b5c7'; context.font = '500 16px DM Mono, monospace';
  context.fillText('SOLUZIONE', 80, 1121);
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

canvas.addEventListener('pointerdown', event => {
  if (state.revealed || state.revealing || (state.mode === 'room' &&
    (!state.room || state.room.phase !== 'drawing' || state.room.you.submitted || state.roomSubmitting ||
      Date.now() + state.clockOffset < state.room.startsAt || Date.now() + state.clockOffset >= state.room.deadline))) return;
  event.preventDefault();canvas.setPointerCapture(event.pointerId);
  state.drawing = true;state.strokes.push([pointerPoint(event)]);
  $('graphHint').classList.add('hide');updateButtons();render();
});
canvas.addEventListener('pointermove', event => {
  if (!state.drawing) return;
  event.preventDefault();
  const stroke = state.strokes.at(-1);
  const point = pointerPoint(event);
  const last = stroke.at(-1);
  if (Math.hypot((point.x - last.x) * state.width, (point.y - last.y) * state.height) >= 1.5) {
    stroke.push(point);updateButtons();render();
  }
});
function stopDrawing() { state.drawing = false;updateButtons(); }
canvas.addEventListener('pointerup', stopDrawing);
canvas.addEventListener('pointercancel', stopDrawing);

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
  $('statusText').textContent = 'LA CURVA PRENDE FORMA…';
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

function finishReveal() {
  state.revealing = false;state.revealed = true;render();
  const score = scoreNormalizedDrawing(state.currentLevel, state.strokes);
  state.scores.set(state.levelIndex, Math.max(score, state.scores.get(state.levelIndex) || 0));
  $('scoreNumber').textContent = String(score);
  const verdict = score >= 85 ? ['Visione matematica', 'La curva era già nella tua testa.']
    : score >= 65 ? ['Ci sei quasi', 'La forma c’è. Qualche tratto ti è sfuggito.']
    : score >= 40 ? ['Buon intuito', 'Hai colto qualcosa: confronta i due tratti.']
    : ['Riprova a immaginarla', 'Ora guarda dove la formula cambia direzione.'];
  $('scoreTitle').textContent = verdict[0];$('scoreDescription').textContent = verdict[1];
  $('levelPrompt').textContent = state.currentLevel.prompt;
  $('scoreBreakdown').hidden = true;
  $('scoreCard').hidden = false;
  showExplanation();
  reactToScore(score);
  $('statusText').textContent = `RISULTATO · ${score}/100`;
  $('playBtn').hidden = true;$('nextBtn').hidden = false;
  $('retryBtn').hidden = false;
  $('skipBtn').hidden = true;
  $('nextBtn').textContent = state.levelIndex === state.soloDeck.length - 1
    ? state.mode === 'journey' ? 'Nuovo percorso ↗' : 'Altre curve ↗' : 'Prossima sfida →';
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
  $('explanationText').textContent = explanationForSpec(state.currentLevel.spec);
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
  $('roomError').textContent = message;
  $('roomError').hidden = !message;
}

async function roomRequest(path, method = 'GET', data, token = state.roomSession?.token) {
  const response = await fetch(path, { method, headers: {
    ...(data ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { 'X-Player-Token': token } : {})
  }, body: data ? JSON.stringify(data) : undefined });
  const result = response.headers.get('content-type')?.includes('application/json')
    ? await response.json() : { error: 'Per giocare in stanza serve il server Node. Avvia con npm start.' };
  if (!response.ok) throw new Error(result.error || 'Connessione non riuscita.');
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
  if (location.hostname.endsWith('.trycloudflare.com')) {
    const poll = async () => {
      if (state.roomSession?.code !== code || state.roomSession?.token !== token) return;
      try {
        const result = await roomRequest(`/api/rooms/${code}`, 'GET', undefined, token);
        if (state.roomSession?.code === code && state.roomSession?.token === token) {
          showRoomError(''); applyRoomSnapshot(result.room);
        }
      } catch { showRoomError('Connessione interrotta. Riconnessione in corso…'); }
      if (state.roomSession?.code === code && state.roomSession?.token === token) state.roomPollTimer = setTimeout(poll, 600);
    };
    state.roomPollTimer = setTimeout(poll, 600);
  } else {
    const source = new EventSource(`/api/rooms/${code}/events?token=${encodeURIComponent(token)}`);
    source.onmessage = event => { showRoomError(''); applyRoomSnapshot(JSON.parse(event.data)); };
    source.onerror = () => showRoomError('Connessione interrotta. Riconnessione in corso…');
    state.roomEvents = source;
  }
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
    meta.textContent = room.phase === 'lobby' ? 'PRONTO' : room.phase === 'drawing'
      ? player.submitted ? 'INVIATO ✓' : 'DISEGNA…'
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
  $('startRoomBtn').textContent = room.phase === 'finished' ? 'Nuova partita ↗' : `Inizia ${room.settings.rounds} ${room.settings.rounds === 1 ? 'sfida' : 'sfide'} ↗`;
  $('roomMessage').textContent = room.phase === 'lobby'
    ? `${room.players.length} ${room.players.length === 1 ? 'giocatore' : 'giocatori'} · ${room.settings.rounds} ${room.settings.rounds === 1 ? 'sfida' : 'sfide'} · ${room.settings.seconds} s per curva · ${room.settings.difficultyMode === 'constant' ? room.settings.difficulty.toLowerCase() + ' costante' : 'difficoltà crescente'}${room.settings.rush ? ` · ${room.settings.rushSeconds} s dopo il primo invio` : ''}`
    : room.phase === 'drawing' ? `${room.players.filter(player => player.submitted).length}/${room.players.length} disegni inviati · la soluzione appare quando tutti confermano o allo scadere.`
    : room.phase === 'reveal' ? 'Confronta i tratti. La prossima curva arriva tra pochi secondi.'
    : `🏆 ${room.players[0]?.name ?? 'Nessuno'} · ${room.players[0]?.total ?? 0} punti. ${room.you.isHost ? 'Puoi avviare una rivincita.' : 'Aspetta una rivincita.'}`;
  if (room.phase === 'lobby') syncLobbySettings(room.settings);
  renderRoomPlayers(room);
  $('challengeHud').hidden = room.phase === 'lobby';
  $('timerStrip').hidden = room.phase !== 'drawing';
  $('timerText').hidden = room.phase !== 'drawing';
  $('roundLabel').textContent = `SFIDA ${room.phase === 'finished' && state.archive ? state.archiveRoundIndex + 1 : room.roundIndex + 1} / ${room.roundCount}`;
  $('playHeading').textContent = room.phase === 'lobby' ? 'Aspetta chi ospita' : room.phase === 'finished' ? 'Partita finita!' : 'Come sarà la curva?';
  $('playBtn').hidden = room.phase !== 'drawing' || room.you.submitted || state.roomSubmitting;
  $('nextBtn').hidden = true; $('retryBtn').hidden = true; $('skipBtn').hidden = true;
  $('playLabel').textContent = 'Conferma disegno';
  $('waitingCard').hidden = room.phase !== 'drawing' || !room.you.submitted;
  if (room.phase === 'drawing') $('statusText').textContent = room.you.submitted ? 'DISEGNO INVIATO · ASPETTA' : 'DISEGNA PRIMA CHE SCADA IL TEMPO';
  if (room.phase === 'lobby') {
    $('graphHint').classList.remove('hide');
    $('graphHint').lastElementChild.innerHTML = 'La sfida apparirà qui<br />quando inizia la partita.';
  }
  if (room.phase === 'finished') $('statusText').textContent = 'PARTITA COMPLETATA';
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
    $('graphHint').lastElementChild.innerHTML = 'Traccia la curva<br />con il dito o il mouse.';
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
  $('scoreTitle').textContent = accuracy >= 85 ? 'Curva centrata!' : accuracy >= 60 ? 'Buona intuizione' : accuracy >= 30 ? 'Qualche svolta giusta' : 'Curva sfuggita';
  $('scoreDescription').textContent = state.currentLevel.prompt;
  $('scoreBreakdown').textContent = `${accuracy} forma + ${speed} velocità = ${points} punti`;
  $('scoreBreakdown').hidden = false;
  $('scoreCard').hidden = false;
  showExplanation();
  $('levelPrompt').textContent = state.currentLevel.prompt;
  $('statusText').textContent = `RISULTATO · ${points} PUNTI`;
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
  try { await navigator.clipboard.writeText(url.toString()); $('copyRoomBtn').textContent = 'Link copiato ✓'; }
  catch { $('copyRoomBtn').textContent = 'Copia non riuscita'; }
  setTimeout(() => { $('copyRoomBtn').textContent = 'Copia link'; }, 2200);
});
$('leaveRoomBtn').addEventListener('click', () => { leaveRoom(); setMode('journey'); });

setInterval(tickRoomClock, 100);

new ResizeObserver(resizeCanvas).observe(wrap);
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
