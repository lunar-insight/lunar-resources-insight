// Lowest modal glass opacity for the tinted states inside the selection modals and the layers catalog.
//
//   node docs/measurements/dark-contrast/modal-min.mjs [brightness] [opacity ...]
//
// The brightness (default 1) darkens the white backdrop first, as backdrop-filter: brightness() does.
// Each opacity listed (default 0.83 and 0.86) adds a column with the ratio at that modal glass.
//
// The modal (#191d25) is composited over a white and a black backdrop, then the state's tint over it,
// and the worst ratio is kept. A selected or highlighted state replaces the card's resting fill, so a
// state lists only its own tint. Text needs 4.5:1, icons and large text 3:1. Opacities are searched in
// steps of 0.01.

const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const over = (c, a, under) => c.map((v, i) => a * v + (1 - a) * under[i]);
const hex = h => h.replace('#', '').match(/../g).map(x => parseInt(x, 16));

const MODAL = [25, 29, 37];
const BRIGHTNESS = Number(process.argv[2] ?? 1);
const OPACITIES = process.argv.length > 3 ? process.argv.slice(3).map(Number) : [0.83, 0.86];
const BACKDROPS = [[255, 255, 255].map(v => v * BRIGHTNESS), [0, 0, 0]];
const CARD = [45, 55, 65, 0.3];
const BLUE = [59, 130, 246];
const GRAY = [128, 128, 128];

// [state, tints from bottom to top as [r, g, b, alpha], text color, need]
const STATES = [
  ['mineral or compound card, resting', [CARD], '#b6bbc1', 4.5],
  ['mineral or compound card, selected', [[...BLUE, 0.15]], '#b6bbc1', 4.5],
  ['mineral or rock card, highlighted', [[251, 146, 60, 0.2]], '#b6bbc1', 4.5],
  ['mineral or rock card, highlighted', [[251, 146, 60, 0.2]], '#e0e0e0', 4.5],
  ['mineral or rock card, selected and highlighted', [[147, 51, 234, 0.2]], '#b6bbc1', 4.5],
  ['periodic table cell, selected', [[...BLUE, 0.15]], '#e0e0e0', 4.5],
  ['periodic table symbol, large', [], '#aab6bb', 3],
  ['derived index card, resting', [CARD], '#aab6bb', 4.5],
  ['derived index card, active', [[...BLUE, 0.1]], '#aab6bb', 4.5],
  ['catalog cell', [], '#aab6bb', 4.5],
  ['catalog cell, hovered row', [[...GRAY, 0.08]], '#aab6bb', 4.5],
  ['catalog unavailable icon, hovered row', [[...GRAY, 0.08]], '#e05353', 3],
  ['catalog unavailable icon, hovered row', [[...GRAY, 0.08]], '#ff5449', 3],
];

// Category chips (selected, 30% tint) and tags (15% tint on a hovered row), text at 40% and at 50% of
// the category color, the rest white
const CATEGORIES = {
  basemap: [128, 128, 128], geographical: [34, 197, 94], chemical: [147, 51, 234], compound: [234, 179, 8],
  'derived index': [249, 115, 22], rock: [59, 212, 246], mineral: [59, 130, 246],
};
for (const share of [0.4, 0.5]) {
  for (const [name, rgb] of Object.entries(CATEGORIES)) {
    const text = over(rgb, share, [255, 255, 255]);
    STATES.push([`catalog chip ${name} at ${share * 100}%, selected`, [[...rgb, 0.3]], text, 4.5]);
    STATES.push([`catalog tag ${name} at ${share * 100}%, hovered row`, [[...GRAY, 0.08], [...rgb, 0.15]], text, 4.5]);
  }
}

function worst(alpha, tints, text) {
  return Math.min(...BACKDROPS.map(backdrop => {
    let bg = over(MODAL, alpha, backdrop);
    for (const t of tints) bg = over(t.slice(0, 3), t[3], bg);
    return ratio(text, bg);
  }));
}

const label = c => typeof c === 'string' ? c : '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
for (const [state, tints, color, need] of STATES) {
  const text = typeof color === 'string' ? hex(color) : color;
  let min = 'none';
  for (let a = 0; a <= 1.0001; a += 0.01) if (worst(a, tints, text) >= need) { min = a.toFixed(2); break; }
  console.log(`${state}, ${label(color)}: needs ${need}, min glass ${min}, `
    + OPACITIES.map(o => `${worst(o, tints, text).toFixed(2)} at ${o}`).join(', '));
}
