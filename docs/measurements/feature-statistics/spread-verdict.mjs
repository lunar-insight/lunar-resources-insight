// Compares the two spread bands over the same shapes, and computes the ratio
// the verdict word is based on: the shape's p15 to p85 width divided by the
// layer's whole Moon p15 to p85 width.
//
// The whole Moon width comes from the request LayerStatsService sends, and
// from a finer read of the same layer to show what that request's overview
// changes.
//
// Requires the dev stack running.
//
//   node docs/measurements/feature-statistics/spread-verdict.mjs

import { LAYERS, SHAPES, shapeStats, layerStats, fmt } from './lib.mjs';

const RUN_LAYERS = [
  'thoriumPrettyman2d', 'thoriumLpHalfDeg', 'hydrogenLawrence', 'feoPrettyman2d',
  'feoClementine', 'mgNumberClementine', 'plagioclaseKaguyaMi', 'ironCh2Class',
];

console.log('Whole Moon p15 to p85, app request (max_size 1024) and a finer read (max_size 4096)');
console.log('  layer                    p15     p85   width | p15     p85   width');
const globalWidth = {};
for (const layer of RUN_LAYERS) {
  const app = await layerStats(LAYERS[layer].file);
  const fine = await layerStats(LAYERS[layer].file, { maxSize: 4096 });
  globalWidth[layer] = app.percentile_85 - app.percentile_15;
  console.log(
    `  ${layer.padEnd(22)} ${fmt(app.percentile_15).padStart(6)} ${fmt(app.percentile_85).padStart(7)} ${fmt(globalWidth[layer]).padStart(7)} |` +
    ` ${fmt(fine.percentile_15).padStart(6)} ${fmt(fine.percentile_85).padStart(7)} ${fmt(fine.percentile_85 - fine.percentile_15).padStart(7)}`,
  );
}

console.log('\nPer shape. Ratio is shape width over whole Moon width.');
console.log('  layer                  shape               cover    mean   mean±std        p15 to p85      ratio');
const rows = [];
for (const layer of RUN_LAYERS) {
  for (const [shape, box] of Object.entries(SHAPES)) {
    const result = await shapeStats(LAYERS[layer].file, box);
    if (result.status !== 200 || !result.b1.count) {
      console.log(`  ${layer.padEnd(22)} ${shape.padEnd(18)}  no data (HTTP ${result.status})`);
      continue;
    }
    const b = result.b1;
    const ratio = (b.percentile_85 - b.percentile_15) / globalWidth[layer];
    rows.push({ layer, shape, ratio });
    console.log(
      `  ${layer.padEnd(22)} ${shape.padEnd(18)} ${fmt(b.valid_percent, 0).padStart(5)}% ${fmt(b.mean).padStart(7)}` +
      `  ${fmt(b.mean - b.std).padStart(6)} ${fmt(b.mean + b.std).padStart(6)}  ${fmt(b.percentile_15).padStart(6)} ${fmt(b.percentile_85).padStart(6)}` +
      `  ${fmt(ratio).padStart(9)}`,
    );
  }
}

console.log('\nRatios sorted');
for (const { layer, shape, ratio } of rows.sort((a, b) => a.ratio - b.ratio)) {
  console.log(`  ${fmt(ratio).padStart(5)}  ${layer} / ${shape}`);
}
