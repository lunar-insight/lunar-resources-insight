// Lowest glass opacity for text on the hover and selection tints of the scanner menu and the Inspector.
//
//   node docs/measurements/dark-contrast/tinted-states.mjs [brightness] [opacity ...]
//
// The surface is composited over a white and a black backdrop, then the state's tints, and the worst
// ratio is kept. The brightness (default 1) darkens the white backdrop first, as
// backdrop-filter: brightness() does. Each opacity listed (default 0.92) adds a column with the
// ratio at that glass. Text needs 4.5:1, icons 3:1.

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (c, a, under) => c.map((v, i) => a * v + (1 - a) * under[i]);
const hex = h => h.replace('#', '').match(/../g).map(x => parseInt(x, 16));

const BRIGHTNESS = Number(process.argv[2] ?? 1);
const OPACITIES = process.argv.length > 3 ? process.argv.slice(3).map(Number) : [0.92];
const BACKDROPS = [[255, 255, 255].map(v => v * BRIGHTNESS), [0, 0, 0]];

const GRADIENT = [[35, 41, 53], [43, 53, 62]];
const FLAT = [[35, 41, 53]];
const ACCENT = [133, 162, 175];
const CARD = [0, 0, 0, 0.22];
const ROWS = { chemical: [147, 51, 234], compound: [234, 179, 8], 'derived index': [249, 115, 22], mineral: [59, 130, 246] };

// [state, surface ends, tints from bottom to top as [r, g, b, alpha], text color, need]
const STATES = [];
for (const [name, rgb] of Object.entries(ROWS)) {
  STATES.push([`scanner row ${name}, hovered`, GRADIENT, [[...rgb, 0.1]], '#aab6bb', 4.5]);
  STATES.push([`scanner row ${name}, hovered`, GRADIENT, [[...rgb, 0.1]], '#e0e0e0', 4.5]);
  STATES.push([`scanner row ${name}, selected and hovered`, GRADIENT, [[...rgb, 0.2]], '#e0e0e0', 4.5]);
  STATES.push([`scanner row ${name}, selected check`, GRADIENT, [[...rgb, 0.14]], over(rgb, 0.4, [255, 255, 255]), 3]);
}
STATES.push(
  ['Inspector pill or chart tab, hovered', GRADIENT, [[...ACCENT, 0.18]], '#b6bbc1', 4.5],
  ['Inspector pill or chart tab, hovered', GRADIENT, [[...ACCENT, 0.18]], '#e0e0e0', 4.5],
  ['Inspector pill or chart tab, selected', GRADIENT, [[...ACCENT, 0.3]], '#b6bbc1', 4.5],
  ['Inspector pill or chart tab, selected', GRADIENT, [[...ACCENT, 0.3]], '#e0e0e0', 4.5],
  ['Inspector menu item, focused', FLAT, [[...ACCENT, 0.2]], '#b6bbc1', 4.5],
  ['Inspector menu item, focused', FLAT, [[...ACCENT, 0.2]], '#e0e0e0', 4.5],
  ['Inspector dataset line, hovered, variant', GRADIENT, [CARD, [...ACCENT, 0.1]], '#aab6bb', 4.5],
  ['Inspector dataset line, hovered, name', GRADIENT, [CARD, [...ACCENT, 0.1]], '#b6bbc1', 4.5],
);

function worst(stops, alpha, tints, text) {
  let r = Infinity;
  for (const backdrop of BACKDROPS) for (const s of stops) {
    let bg = over(s, alpha, backdrop);
    for (const t of tints) bg = over(t.slice(0, 3), t[3], bg);
    r = Math.min(r, ratio(text, bg));
  }
  return r;
}

const label = c => typeof c === 'string' ? c : '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
for (const [state, stops, tints, color, need] of STATES) {
  const text = typeof color === 'string' ? hex(color) : color;
  let min = 'none';
  for (let a = 0; a <= 1.0001; a += 0.01) if (worst(stops, a, tints, text) >= need) { min = a.toFixed(2); break; }
  console.log(`${state}, ${label(color)}: needs ${need}, min glass ${min}, `
    + OPACITIES.map(o => `${worst(stops, o, tints, text).toFixed(2)} at ${o}`).join(', '));
}
