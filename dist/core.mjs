export const WORLD = { xmin: -5, xmax: 5, ymin: -4, ymax: 4 };
const SCORE_CANVAS = { width: 900, height: 500 };

export function worldToPixel(x, y, width, height) {
  return { x: (x - WORLD.xmin) / (WORLD.xmax - WORLD.xmin) * width,
    y: (WORLD.ymax - y) / (WORLD.ymax - WORLD.ymin) * height };
}

export function pixelToWorld(px, py, width, height) {
  return { x: WORLD.xmin + px / width * (WORLD.xmax - WORLD.xmin),
    y: WORLD.ymax - py / height * (WORLD.ymax - WORLD.ymin) };
}

export function targetSamples(level, width, height, step = 3) {
  const samples = [];
  for (let px = 0; px <= width; px += step) {
    const x = pixelToWorld(px, 0, width, height).x;
    const y = level.fn(x);
    if (Number.isFinite(y) && y >= WORLD.ymin && y <= WORLD.ymax) {
      samples.push({ x: px, y: worldToPixel(x, y, width, height).y });
    }
  }
  return samples;
}

function denseStrokePoints(strokes, spacing = 3) {
  const points = [];
  for (const stroke of strokes) {
    if (!stroke.length) continue;
    points.push(stroke[0]);
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1], b = stroke[i];
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.ceil(distance / spacing);
      if (points.length + steps > 5000) return null;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      }
    }
  }
  return points;
}

export function scoreDrawing(level, strokes, width, height) {
  const drawn = denseStrokePoints(strokes);
  if (!drawn || drawn.length < 8) return 0;
  const target = targetSamples(level, width, height, 3);
  if (!target.length) return 0;
  const breakPixels = (level.breaks || []).map(x => worldToPixel(x, 0, width, height).x);
  const continuous = (a, b, maxGap) => b.x - a.x <= maxGap &&
    !breakPixels.some(x => a.x < x && b.x >= x);

  // Use the median of everything drawn at each x. Picking the point closest
  // to the answer let loops and dense scribbles masquerade as a correct curve.
  const profile = target.map(point => {
    const candidates = drawn.filter(candidate => Math.abs(candidate.x - point.x) <= 5 &&
      !breakPixels.some(x => (candidate.x < x) !== (point.x < x)));
    const closestX = Math.min(...candidates.map(candidate => Math.abs(candidate.x - point.x)));
    const nearby = candidates.filter(candidate => Math.abs(candidate.x - point.x) <= Math.max(1.2, closestX + .5))
      .map(candidate => candidate.y).sort((a, b) => a - b);
    return nearby.length ? {
      y: nearby[Math.floor(nearby.length / 2)],
      spread: nearby.at(-1) - nearby[0]
    } : null;
  });
  const covered = target.map((point, index) => ({ point, value: profile[index] })).filter(entry => entry.value);
  if (covered.length < 8) return 0;
  const coverage = covered.length / target.length;
  const position = covered.reduce((sum, { point, value }) =>
    sum + Math.exp(-Math.abs(value.y - point.y) / 105), 0) / covered.length;

  // Extra marks count against a guess even when one line crosses the answer.
  let precision = 0, precisionCount = 0;
  for (let i = 0; i < drawn.length; i += 3) {
    const point = drawn[i];
    const distances = target.filter(candidate => Math.abs(candidate.x - point.x) <= 8)
      .map(candidate => Math.abs(candidate.y - point.y));
    precision += distances.length ? Math.exp(-Math.min(...distances) / 105) : 0;
    precisionCount++;
  }
  precision /= precisionCount;

  let slopeTotal = 0, slopeCount = 0, bendTotal = 0, bendCount = 0;
  for (let i = 0; i + 20 < target.length; i += 5) {
    const a = target[i], m = target[i + 10], b = target[i + 20];
    const da = profile[i], dm = profile[i + 10], db = profile[i + 20];
    if (!continuous(a, b, 65) || !da || !db) continue;
    slopeCount++;
    slopeTotal += Math.exp(-Math.abs((db.y - da.y) - (b.y - a.y)) / 35);
    if (dm) {
      bendCount++;
      bendTotal += Math.exp(-Math.abs((db.y - 2 * dm.y + da.y) - (b.y - 2 * m.y + a.y)) / 45);
    }
  }
  const slope = slopeCount ? slopeTotal / slopeCount : 0;
  const bend = bendCount ? bendTotal / bendCount : 0;

  // A parabola needs its turn; a cubic needs both. Missing the defining turn
  // costs more than omitting the ends of a straight line.
  let turns = 0, matchingTurns = 0, lastTurn = -100;
  const smoothDrawnAt = index => {
    const values = [];
    for (let offset = -4; offset <= 4; offset++) {
      const sample = profile[index + offset];
      if (sample && (!offset || continuous(target[Math.min(index, index + offset)], target[Math.max(index, index + offset)], 15))) values.push(sample.y);
    }
    return values.length >= 3 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  for (let i = 25; i + 25 < target.length; i++) {
    const left = target[i - 25], mid = target[i], right = target[i + 25];
    if (i - lastTurn < 12 || !continuous(left, right, 155)) continue;
    const before = target[i - 4], after = target[i + 4];
    if ((mid.y - before.y) * (after.y - mid.y) >= 0 ||
        Math.min(Math.abs(left.y - mid.y), Math.abs(right.y - mid.y)) < 6) continue;
    turns++; lastTurn = i;
    const a = smoothDrawnAt(i - 25), m = smoothDrawnAt(i), b = smoothDrawnAt(i + 25);
    if (a !== null && m !== null && b !== null &&
        Math.sign(m - a) === Math.sign(mid.y - left.y) &&
        Math.sign(b - m) === Math.sign(right.y - mid.y) &&
        Math.abs(m - a) >= .35 * Math.abs(mid.y - left.y) &&
        Math.abs(b - m) >= .35 * Math.abs(right.y - mid.y)) matchingTurns++;
  }
  const turnsFactor = turns ? .5 + .5 * matchingTurns / turns : 1;

  let excessSpread = 0, drawnVariation = 0, targetVariation = 0;
  for (let i = 0; i < target.length; i++) {
    const value = profile[i];
    if (!value) continue;
    const neighbors = target.filter(point => Math.abs(point.x - target[i].x) <= 5);
    const targetSpread = Math.max(...neighbors.map(point => point.y)) - Math.min(...neighbors.map(point => point.y));
    excessSpread += Math.max(0, value.spread - targetSpread - 25);
    if (i && profile[i - 1] && continuous(target[i - 1], target[i], 4)) {
      drawnVariation += Math.abs(value.y - profile[i - 1].y);
      targetVariation += Math.abs(target[i].y - target[i - 1].y);
    }
  }
  const ambiguityFactor = Math.exp(-excessSpread / covered.length / 90);
  const extraVariation = Math.max(0, drawnVariation - targetVariation - Math.max(250, targetVariation * .5));
  const roughnessFactor = Math.exp(-extraVariation / Math.max(500, targetVariation * 1.2));
  const completeness = .47 + .53 * Math.sqrt(coverage);
  const quality = .28 * position + .16 * precision + .37 * slope + .19 * bend;
  let generalScore = 100 * quality * completeness * turnsFactor * ambiguityFactor * roughnessFactor;
  if (level.tangentScoring) {
    // Flat guesses can sit near the middle of many tangent branches. Require
    // some of the target's steep motion within the drawn, continuous segments.
    const variationRecall = Math.min(1, drawnVariation / Math.max(1, targetVariation * .35));
    generalScore *= .15 + .85 * variationRecall;
  }
  if (level.spikeScoring) {
    // A periodic reset is defined by its spikes. Most samples lie on the low
    // baseline, so ordinary pointwise similarity would reward a flat line.
    const events = breakPixels.filter(x => x > 20 && x < width - 90).map(x => {
      const near = target.filter(point => point.x >= x - 1 && point.x <= x + 18);
      const later = target.filter(point => point.x >= x + 42 && point.x <= x + 86);
      if (!near.length || !later.length) return null;
      const peak = near.reduce((a, b) => a.y < b.y ? a : b);
      const baseline = later.map(point => point.y).sort((a, b) => a - b)[Math.floor(later.length / 2)];
      const expectedRise = baseline - peak.y;
      if (expectedRise < 45) return null;
      const candidates = drawn.filter(point => point.x >= x - 1 && point.x <= x + 18);
      const after = drawn.filter(point => point.x >= x + 42 && point.x <= x + 86);
      if (!candidates.length || !after.length) return 0;
      const drawnPeak = candidates.reduce((a, b) => a.y < b.y ? a : b);
      const afterYs = after.map(point => point.y).sort((a, b) => a - b);
      const drawnBaseline = afterYs[Math.floor(afterYs.length / 2)];
      const heightMatch = Math.exp(-Math.abs(drawnPeak.y - peak.y) / 200);
      const baselineMatch = Math.exp(-Math.abs(drawnBaseline - baseline) / 100);
      const rise = Math.max(0, drawnBaseline - drawnPeak.y);
      const riseMatch = Math.min(1, rise / (expectedRise * .75));
      const locationMatch = Math.exp(-Math.max(0, Math.abs(drawnPeak.x - x) - 5) / 12);
      return heightMatch * baselineMatch * riseMatch * locationMatch;
    }).filter(value => value !== null);
    if (events.length) {
      const recall = events.reduce((sum, value) => sum + value, 0) / events.length;
      return Math.max(0, Math.min(100, Math.round(.15 * generalScore + 85 * recall)));
    }
  }
  return Math.max(0, Math.min(100, Math.round(generalScore)));
}

export function scoreNormalizedDrawing(level, strokes) {
  const { width, height } = SCORE_CANVAS;
  const pixels = strokes.map(stroke => stroke.map(point => ({ x: point.x * width, y: point.y * height })));
  return scoreDrawing(level, pixels, width, height);
}
