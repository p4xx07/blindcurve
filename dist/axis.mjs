import { WORLD } from './core.mjs';

export function piTicks() {
  const ticks = [];
  for (let half = -3; half <= 3; half++) {
    if (!half) continue;
    const x = half * Math.PI / 2;
    if (x <= WORLD.xmin || x >= WORLD.xmax) continue;
    const numerator = Math.abs(half);
    const label = numerator === 1 ? 'π/2' : numerator === 2 ? 'π' : `${numerator}π/2`;
    ticks.push({ x, label: half < 0 ? `−${label}` : label });
  }
  return ticks;
}
