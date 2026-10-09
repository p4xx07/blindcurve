import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreDrawing, targetSamples, worldToPixel } from '../dist/core.mjs';
import { DIFFICULTIES, explanationForSpec, generateSpecs, levelFromSpec } from '../dist/generated.mjs';
import { difficultyNames, englishExplanations, levelText } from '../dist/i18n.mjs';

test('every generated family has English labels and an English explanation', () => {
  for (const difficulty of DIFFICULTIES) for (let family = 0; family < 5; family++) {
    const spec = { difficulty, family, seed: 42 };
    assert.ok(difficultyNames.en[difficulty]);
    assert.ok(levelText(spec, 'en').name.length > 3);
    assert.ok(levelText(spec, 'en').prompt.length > 8);
    assert.ok(englishExplanations[difficulty][family].length > 40);
  }
});

test('new decks generate varied equations at every difficulty', () => {
  const bands = DIFFICULTIES.flatMap(difficulty => Array(5).fill(difficulty));
  const first = generateSpecs(bands, () => .1).map(levelFromSpec);
  const second = generateSpecs(bands, () => .9).map(levelFromSpec);
  assert.equal(first.length, 20);
  assert.equal(new Set(first.map(level => level.formula)).size, 20);
  assert.ok(first.some((level, index) => level.formula !== second[index].formula));
  assert.deepEqual(first.map(level => level.difficulty), bands);
});

test('zero terms disappear from formulas and every family has a pattern explanation', () => {
  for (const difficulty of DIFFICULTIES) for (let family = 0; family < 5; family++) for (let seed = 0; seed < 100; seed++) {
    const spec = { difficulty, family, seed };
    const level = levelFromSpec(spec);
    assert.doesNotMatch(level.formula, /[+−]\s*0(?:,0+)?<i>x<\/i>/, level.formula);
    assert.ok(explanationForSpec(spec).length > 40, `${difficulty}/${family}`);
  }
});

test('shifted sine formulas use one pair of parentheses', () => {
  for (let seed = 0; seed < 100; seed++) {
    const level = levelFromSpec({ difficulty: 'FACILE', family: 3, seed });
    assert.doesNotMatch(level.formula, /sin\(\(/, level.formula);
    assert.match(level.formula, /sin\(<i>x<\/i>(?: [−+] [^)]*)?\)/);
  }
});

test('a close full drawing beats partial and inaccurate drawings', () => {
  const level = levelFromSpec({ difficulty: 'FACILE', family: 0, seed: 42 }), width = 900, height = 500;
  const curve = targetSamples(level, width, height);
  const perfect = scoreDrawing(level, [curve], width, height);
  const partial = scoreDrawing(level, [curve.slice(0, Math.floor(curve.length / 3))], width, height);
  const shifted = scoreDrawing(level, [curve.map(p => ({ x: p.x, y: p.y + 90 }))], width, height);
  const roughlyShifted = scoreDrawing(level, [curve.map(p => ({ x: p.x, y: p.y + height / 8 }))], width, height);
  const flat = scoreDrawing(level, [[{ x: 0, y: height / 2 }, { x: width, y: height / 2 }]], width, height);
  assert.ok(perfect >= 95, `perfect: ${perfect}`);
  assert.ok(partial < perfect - 20, `partial: ${partial}, perfect: ${perfect}`);
  assert.ok(shifted <= perfect - 25, `shifted: ${shifted}, perfect: ${perfect}`);
  assert.ok(roughlyShifted >= 60 && roughlyShifted < perfect, `rough sketch: ${roughlyShifted}`);
  assert.ok(flat < 55, `flat: ${flat}`);
  assert.equal(scoreDrawing(level, [], width, height), 0);
});

test('a correct central sketch of y=x earns about 80 to 85 points, unlike a flat line', () => {
  const level = { fn: x => x, breaks: [] }, width = 900, height = 500;
  const curve = targetSamples(level, width, height);
  const center = curve.filter(point => point.x >= 270 && point.x <= 630);
  const score = scoreDrawing(level, [center], width, height);
  const flat = scoreDrawing(level, [[{ x: 270, y: 250 }, { x: 630, y: 250 }]], width, height);
  assert.ok(score >= 80 && score <= 85, `central line: ${score}`);
  assert.ok(flat < 55, `flat line: ${flat}`);
});

test('generated variations keep a visible curve', () => {
  for (const difficulty of DIFFICULTIES) for (let family = 0; family < 5; family++) for (let seed = 0; seed < 100; seed++) {
    const level = levelFromSpec({ difficulty, family, seed });
    assert.ok(targetSamples(level, 900, 500).length > 50, `${difficulty}/${family}/${seed}`);
  }
});

test('covering the graph with many lines cannot earn a strong score', () => {
  const grid = Array.from({ length: 11 }, (_, i) => [{ x: 0, y: i * 50 }, { x: 900, y: i * 50 }]);
  for (const difficulty of DIFFICULTIES) for (let family = 0; family < 5; family++) {
    const level = levelFromSpec({ difficulty, family, seed: 42 });
    assert.ok(scoreDrawing(level, grid, 900, 500) < 45, level.name);
  }
});

test('separate branches of the hardest function still receive a high score', () => {
  const level = levelFromSpec({ difficulty: 'FOLLE', family: 2, seed: 42 });
  const points = targetSamples(level, 900, 500);
  const strokes = [[]];
  for (let i = 0; i < points.length; i++) {
    const point = points[i], previous = points[i - 1];
    if (previous && (point.x - previous.x > 5 || Math.abs(point.y - previous.y) > 80)) strokes.push([]);
    strokes.at(-1).push(point);
  }
  assert.ok(scoreDrawing(level, strokes, 900, 500) >= 95);
});

test('loops, jagged lines, scribbles and half a parabola cannot score as a plausible guess', () => {
  const width = 900, height = 500;
  const stroke = points => points.map(([x, y]) => worldToPixel(x, y, width, height));
  const cases = [
    { name: 'loop on monotone S', level: { fn: x => -.05 * (x + .5) ** 3 - .6, breaks: [] },
      points: [[-4,-1],[-4,0],[-3,1.1],[-2,1.7],[-1,2],[0,1.7],[.6,.6],[.7,-.2],[0,-1.9],[-.8,-2],[-1.5,-1.4],[-1.2,.2],[0,1.7],[1,2.5],[2,2.9],[3,2.7],[4,2.1],[5,1]], limit: 15 },
    { name: 'wrong trend on cubic', level: { fn: x => -.07 * x ** 3 + .5 * x - .1, breaks: [] },
      points: [[-4.3,3.4],[-4.1,3.4],[-3.6,2.6],[-2.3,1.9],[-2.3,1.1],[-1.5,.7],[-.3,.1],[.2,-.4],[.2,-1],[1,-1.5],[4.4,-3.3]], limit: 30 },
    { name: 'sawtooth on quartic', level: { fn: x => .03*x**4-.5*x*x-.2, breaks: [] },
      points: Array.from({ length: 21 }, (_, i) => [-4.8 + i*.48, i%2 ? -2.5 : 2.7]), limit: 15 },
    { name: 'shifted half parabola', level: { fn: x => -.32*(x+1.4)**2-.8, breaks: [] },
      points: [[-4,-2.4],[-3.6,-1.4],[-3,-.4],[-2.5,0],[-2,.25],[-1.5,.32],[-.5,.4]], limit: 40 }
  ];
  for (const item of cases) {
    const score = scoreDrawing(item.level, [stroke(item.points)], width, height);
    assert.ok(score < item.limit, `${item.name}: ${score}`);
  }
});

test('small drawing wobble keeps a good score across generated shapes', () => {
  const width = 900, height = 500;
  for (const difficulty of DIFFICULTIES) for (let family = 0; family < 5; family++) {
    const level = levelFromSpec({ difficulty, family, seed: 42 });
    const curve = targetSamples(level, width, height);
    const sketch = curve.map((point, i) => ({ ...point, y: point.y + 8 * Math.sin(i * .28) }));
    assert.ok(scoreDrawing(level, [sketch], width, height) >= (difficulty === 'FOLLE' ? 75 : 80), `${difficulty}/${family}`);
  }
});

test('easy and medium formulas use readable templates without combined hard patterns', () => {
  for (let seed = 0; seed < 100; seed++) for (let family = 0; family < 5; family++) {
    const easy = levelFromSpec({ difficulty: 'FACILE', family, seed });
    const medium = levelFromSpec({ difficulty: 'MEDIA', family, seed });
    assert.doesNotMatch(easy.formula.replace(/<[^>]+>/g, ''), /e−|\/|sin\([^)]*sin\(/, easy.formula);
    assert.doesNotMatch(medium.formula.replace(/<[^>]+>/g, ''), /e−|mod\(|sin\([^)]*sin\(/, medium.formula);
  }
});

test('thirty constant rounds contain distinct generated formulas', () => {
  for (const difficulty of DIFFICULTIES) {
    const specs = generateSpecs(Array(30).fill(difficulty), () => 0);
    assert.equal(new Set(specs.map(spec => levelFromSpec(spec).formula)).size, 30, difficulty);
  }
});

test('a flat line and random teeth do not score against periodic spikes', () => {
  const width = 900, height = 500;
  const level = {
    fn: x => { const u = ((x + .7) % 1.6 + 1.6) % 1.6; return -2.8 + 5.5 / (1 + 27 * u) + .3 * Math.sin(18 * Math.PI * u); },
    breaks: Array.from({ length: 16 }, (_, i) => (i - 8) * 1.6 - .7).filter(x => x > -5 && x < 5)
  };
  const stroke = points => points.map(([x, y]) => worldToPixel(x, y, width, height));
  const flat = stroke([[-5, -2.5], [5, -2.5]]);
  const randomTeeth = stroke(Array.from({ length: 35 }, (_, i) => [-5 + i * 10 / 34, i % 2 ? -2.6 : 1.5]));
  const periodicTeeth = level.breaks.map(x => stroke([[Math.max(-5, x - .06), -2.6], [x, 1.5], [x + .08, -1.1], [Math.min(5, x + .8), -2.5]]));
  assert.ok(scoreDrawing(level, [flat], width, height) <= 15);
  assert.ok(scoreDrawing(level, [randomTeeth], width, height) <= 15);
  assert.ok(scoreDrawing(level, periodicTeeth, width, height) >= 55);
});
