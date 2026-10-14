export const difficultyNames = {
  it: { FACILE: 'FACILE', MEDIA: 'MEDIA', DIFFICILE: 'DIFFICILE', FOLLE: 'FOLLE' },
  en: { FACILE: 'EASY', MEDIA: 'MEDIUM', DIFFICILE: 'HARD', FOLLE: 'WILD' }
};

const names = {
  FACILE: ['Slanted line', 'Parabola', 'Corner', 'Wave', 'S curve', 'Cosine wave'],
  MEDIA: ['Three crossings', 'Tilted wave', 'Hump or valley', 'Two valleys', 'Square root', 'Shifted cosine'],
  DIFFICILE: ['Two branches', 'Two asymptotes', 'Double dip', 'Wave and parabola', 'Pulse', 'Cosine and parabola', 'Tangent branches', 'Arctangent'],
  FOLLE: ['Accelerating waves', 'Wave within a wave', 'Uneven teeth', 'Twin peaks', 'Impossible shape', 'Fading cosine', 'Wild tangent', 'Twisted arctangent']
};
const prompts = {
  FACILE: ['One slope and one shift.', 'Find the vertex and follow both sides.', 'The curve changes direction at one point.', 'A steady rise and fall.', 'A smooth change of bend near the center.', 'A regular wave that may start at a peak or a valley.'],
  MEDIA: ['Three zeros can make two turns.', 'A wave that rises or falls overall.', 'One turn, then the curve flattens.', 'Two outer turns and one in the middle.', 'The curve starts at a specific point.', 'Find the peaks and valleys of a shifted cosine.'],
  DIFFICILE: ['An asymptote splits the graph.', 'Three regions, separated by two invisible walls.', 'Two valleys and a hump, slightly asymmetric.', 'Oscillations follow a slower curve.', 'The wave is strongest at the center and fades out.', 'A cosine oscillates along a slow curve.', 'Asymptotes split the tangent into separate branches.', 'An S curve flattens on both sides.'],
  FOLLE: ['The waves change pace.', 'One oscillation changes the rhythm of another.', 'Sharp peaks repeat at regular intervals.', 'Two narrow peaks sit above a small wave.', 'Accelerating waves hide a peak.', 'Regular cosine waves fade toward the edges.', 'Periodic branches fade toward the edges.', 'A cubic is bent by arctangent.']
};
export const englishExplanations = {
  FACILE: [
    'The number before x sets the direction and steepness of the line. The last number moves the whole line up or down.',
    'The square makes a U; a negative coefficient flips it. The value inside the brackets shifts the vertex left or right; the last value moves it vertically.',
    'Absolute value makes a V. Find where the expression between the bars is zero: that is the corner. A negative sign flips the V.',
    'Sine makes a regular wave. The first number changes its height, the value in brackets shifts it sideways, and the last number moves it up or down.',
    'The cube makes an S with a change of bend near the y axis. The sign controls whether it rises or falls; the last number moves it vertically.',
    'Cosine starts at a peak when its argument is zero. A half pi shift moves that peak by a quarter of a cycle; the final number shifts the whole wave vertically.'
  ],
  MEDIA: [
    'The curve crosses the x axis wherever one of the three factors is zero. Two turns appear between those crossings.',
    'Picture an ordinary sine wave first. The small linear term tilts its center line while the peaks remain recognizable.',
    'The denominator is smallest at the point shown in brackets. A peak appears there, or a valley when the numerator is negative. The curve flattens away from it.',
    'The fourth power lifts the ends while the negative squared term pushes down near the center. The result has two valleys and a small hump between them.',
    'The square root starts where the expression inside it is zero. It changes quickly at first, then flattens; a negative sign reflects it.',
    'Start with cosine peaks spaced two pi apart. A phase shift moves the peaks sideways; a negative coefficient flips peaks and valleys.'
  ],
  DIFFICILE: [
    'The denominator becomes zero at the value in brackets. That vertical asymptote separates two branches. The final number shifts the line they approach.',
    'The two denominator factors vanish at different x values. Mark those two vertical walls first: they divide the graph into three separate parts.',
    'The fourth power dominates at the edges; the negative squared term pushes down near the center. The small linear term breaks the symmetry.',
    'Combine two shapes in your head: the fast sine wave and the slow parabola. The parabola lifts or lowers the line that the wave follows.',
    'The sine creates the beats. The exponential with |x| makes them fade away from the center. Look for tight waves near zero that shrink toward the sides.',
    'The cosine controls the repeating peaks, while the squared term slowly raises or lowers the center line. Sketch the center line first, then the wave.',
    'Tangent has vertical asymptotes where its argument reaches pi over two plus a multiple of pi. Leave a gap at each asymptote and draw every branch separately.',
    'Arctangent makes an S that flattens toward horizontal limits on each side. The sign flips its direction; the argument controls how steep the center is.'
  ],
  FOLLE: [
    'The sine contains x². It changes faster away from the center, so the waves crowd together. The denominator with |x| reduces their height at the sides.',
    'One sine sits inside another. The inner wave constantly shifts the phase of the outer one, crowding some peaks and spreading out others.',
    'mod(A; P) is the remainder after dividing A by P. Every P units, u resets to zero. Draw the evenly spaced peaks and the drops first; the tiny ripples are a detail.',
    'The two exponentials make narrow peaks at the x values shown in brackets. Away from them, the small sine wave remains, shifted downward.',
    'The first part is a wave that speeds up toward the sides. The added fraction makes a local peak where its bracket is zero. Imagine both shapes laid on top of each other.',
    'The cosine supplies repeated peaks and valleys. The denominator grows away from zero, so the waves become smaller toward the edges.',
    'Find tangent’s vertical asymptotes first and keep the branches apart. The denominator reduces their size away from the center without removing the asymptotes.',
    'The cubic inside arctangent makes the center flatter and the sides bend sharply before leveling off. Sketch the broad S before worrying about exact values.'
  ]
};
export function levelText(spec, locale) {
  return locale === 'en' ? { name: names[spec.difficulty][spec.family], prompt: prompts[spec.difficulty][spec.family] } : null;
}
