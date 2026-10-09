export const difficultyNames = {
  it: { FACILE: 'FACILE', MEDIA: 'MEDIA', DIFFICILE: 'DIFFICILE', FOLLE: 'FOLLE' },
  en: { FACILE: 'EASY', MEDIA: 'MEDIUM', DIFFICILE: 'HARD', FOLLE: 'WILD' }
};

const names = {
  FACILE: ['Slanted line', 'Parabola', 'Corner', 'Wave', 'S curve'],
  MEDIA: ['Three crossings', 'Tilted wave', 'Hump or valley', 'Two valleys', 'Square root'],
  DIFFICILE: ['Two branches', 'Two asymptotes', 'Double dip', 'Wave and parabola', 'Pulse'],
  FOLLE: ['Accelerating waves', 'Wave within a wave', 'Uneven teeth', 'Twin peaks', 'Impossible shape']
};
const prompts = {
  FACILE: ['One slope and one shift.', 'Find the vertex and follow both sides.', 'The curve changes direction at one point.', 'A steady rise and fall.', 'A smooth change of bend near the center.'],
  MEDIA: ['Three zeros can make two turns.', 'A wave that rises or falls overall.', 'One turn, then the curve flattens.', 'Two outer turns and one in the middle.', 'The curve starts at a specific point.'],
  DIFFICILE: ['An asymptote splits the graph.', 'Three regions, separated by two invisible walls.', 'Two valleys and a hump, slightly asymmetric.', 'Oscillations follow a slower curve.', 'The wave is strongest at the center and fades out.'],
  FOLLE: ['The waves change pace.', 'One oscillation changes the rhythm of another.', 'Sharp peaks repeat at regular intervals.', 'Two narrow peaks sit above a small wave.', 'Accelerating waves hide a peak.']
};
export const englishExplanations = {
  FACILE: [
    'The number before x sets the direction and steepness of the line. The last number moves the whole line up or down.',
    'The square makes a U; a negative coefficient flips it. The value inside the brackets shifts the vertex left or right; the last value moves it vertically.',
    'Absolute value makes a V. Find where the expression between the bars is zero: that is the corner. A negative sign flips the V.',
    'Sine makes a regular wave. The first number changes its height, the value in brackets shifts it sideways, and the last number moves it up or down.',
    'The cube makes an S with a change of bend near the y axis. The sign controls whether it rises or falls; the last number moves it vertically.'
  ],
  MEDIA: [
    'The curve crosses the x axis wherever one of the three factors is zero. Two turns appear between those crossings.',
    'Picture an ordinary sine wave first. The small linear term tilts its center line while the peaks remain recognizable.',
    'The denominator is smallest at the point shown in brackets. A peak appears there, or a valley when the numerator is negative. The curve flattens away from it.',
    'The fourth power lifts the ends while the negative squared term pushes down near the center. The result has two valleys and a small hump between them.',
    'The square root starts where the expression inside it is zero. It changes quickly at first, then flattens; a negative sign reflects it.'
  ],
  DIFFICILE: [
    'The denominator becomes zero at the value in brackets. That vertical asymptote separates two branches. The final number shifts the line they approach.',
    'The two denominator factors vanish at different x values. Mark those two vertical walls first: they divide the graph into three separate parts.',
    'The fourth power dominates at the edges; the negative squared term pushes down near the center. The small linear term breaks the symmetry.',
    'Combine two shapes in your head: the fast sine wave and the slow parabola. The parabola lifts or lowers the line that the wave follows.',
    'The sine creates the beats. The exponential with |x| makes them fade away from the center. Look for tight waves near zero that shrink toward the sides.'
  ],
  FOLLE: [
    'The sine contains x². It changes faster away from the center, so the waves crowd together. The denominator with |x| reduces their height at the sides.',
    'One sine sits inside another. The inner wave constantly shifts the phase of the outer one, crowding some peaks and spreading out others.',
    'mod(A; P) is the remainder after dividing A by P. Every P units, u resets to zero. Draw the evenly spaced peaks and the drops first; the tiny ripples are a detail.',
    'The two exponentials make narrow peaks at the x values shown in brackets. Away from them, the small sine wave remains, shifted downward.',
    'The first part is a wave that speeds up toward the sides. The added fraction makes a local peak where its bracket is zero. Imagine both shapes laid on top of each other.'
  ]
};
export function levelText(spec, locale) {
  return locale === 'en' ? { name: names[spec.difficulty][spec.family], prompt: prompts[spec.difficulty][spec.family] } : null;
}
