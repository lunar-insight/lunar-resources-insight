// Contrast of the dark glass surfaces over the bright limb, and the lowest glass opacity that passes.
//
//   node docs/measurements/dark-contrast/min-opacity.mjs [brightness]
//
// Each surface is composited over white, the worst backdrop for light text, at every end of its
// gradient. Text needs 4.5:1, icons and large text 3:1. Opacities are searched in steps of 0.01.
// A brightness below 1 darkens the white first, as backdrop-filter: brightness() does; the default
// is 1, no filter.

const hex = h => h.replace('#', '').match(/../g).map(x => parseInt(x, 16));
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = rgb => 0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (fg, a, bg) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const BRIGHTNESS = Number(process.argv[2] ?? 1);
const WHITE = [255, 255, 255].map(v => v * BRIGHTNESS);

// Worst ratio of a color, itself possibly translucent, on a glass of the given ends and opacity
function worst(stops, alpha, color, colorAlpha = 1) {
  return Math.min(...stops.map(s => {
    const bg = mix(s, alpha, WHITE);
    return ratio(mix(hex(color), colorAlpha, bg), bg);
  }));
}
function minAlpha(stops, color, need, colorAlpha = 1) {
  for (let a = 0; a <= 1.0001; a += 0.01) if (worst(stops, a, color, colorAlpha) >= need) return a.toFixed(2);
  return 'none';
}

const GRADIENT = [[35, 41, 53], [43, 53, 62]];
const PRIMARY = [[35, 41, 53]];
const MODAL = [[25, 29, 37]];
const BLACK = [[0, 0, 0]];

const TERTIARY = '#97a5ab', ADJUSTED = '#aab6bb', NEUTRAL_VARIANT = '#b6bbc1', SECONDARY = '#85a2af';

// [surface, ends, opacity now, [what, color, need, color opacity]]
const SURFACES = [
  ['Top bar', GRADIENT, 0.75, [['label "Measurement"', TERTIARY, 4.5], ['Scanner button label', SECONDARY, 4.5]]],
  ['Bottom bar', GRADIENT, 0.75, [['coordinate and zoom labels', TERTIARY, 4.5], ['coordinate and zoom values', NEUTRAL_VARIANT, 4.5]]],
  ['Navigation dialogs (DraggableContentContainer)', GRADIENT, 0.75, [['body text', NEUTRAL_VARIANT, 4.5], ['section titles', TERTIARY, 4.5]]],
  ['Floating windows, dark (DraggableBoxContentContainer, Inspector)', GRADIENT, 0.92, [['secondary text', TERTIARY, 4.5]]],
  ['Scanner menu and color picker popovers', GRADIENT, 0.75, [['row labels', TERTIARY, 4.5]]],
  ['Info and stat popovers', PRIMARY, 0.7, [['title', TERTIARY, 4.5], ['body', NEUTRAL_VARIANT, 4.5]]],
  ['Viewer buttons and compass', PRIMARY, 0.55, [['icons', TERTIARY, 3]]],
  ['Nomenclature search field and button', PRIMARY, 0.55, [['text and icon', TERTIARY, 4.5], ['placeholder', TERTIARY, 4.5, 0.6]]],
  ['Nomenclature search results', PRIMARY, 0.8, [['result text', TERTIARY, 4.5]]],
  ['Modal (ModalOverlayContainer)', MODAL, 0.75, [['title and legend', TERTIARY, 4.5], ['periodic table symbols, large', SECONDARY, 3]]],
  ['Measurement distance label', BLACK, 0.65, [['distance', '#ffffff', 4.5], ['secondary line', '#ffffff', 4.5, 0.6]]],
];

for (const [name, stops, now, items] of SURFACES) {
  console.log(`\n${name}, glass ${now}`);
  for (const [what, color, need, colorAlpha = 1] of items) {
    const r = worst(stops, now, color, colorAlpha);
    const line = [`  ${what}: ${color}${colorAlpha < 1 ? ` at ${colorAlpha}` : ''} ${r.toFixed(2)} (needs ${need})`,
      `min glass ${minAlpha(stops, color, need, colorAlpha)}`];
    if (color === TERTIARY || color === SECONDARY) {
      line.push(`with ${ADJUSTED} ${minAlpha(stops, ADJUSTED, need)}`, `with ${NEUTRAL_VARIANT} ${minAlpha(stops, NEUTRAL_VARIANT, need)}`);
    }
    if (colorAlpha < 1 && color === '#ffffff') line.push(`with white at 0.75 ${minAlpha(stops, color, need, 0.75)}`);
    console.log(line.join(' | '));
  }
}

console.log(`\nLowest glass per text color at backdrop brightness ${BRIGHTNESS}, text 4.5:1 (icon 3:1):`);
for (const [name, stops] of [['gradient #232935 to #2b353e', GRADIENT], ['flat #232935', PRIMARY], ['flat #191d25', MODAL]]) {
  console.log(`  ${name}: ` + [SECONDARY, TERTIARY, ADJUSTED, NEUTRAL_VARIANT, '#e0e0e0', '#ffffff']
    .map(c => `${c} ${minAlpha(stops, c, 4.5)} (${minAlpha(stops, c, 3)})`).join(', '));
}
