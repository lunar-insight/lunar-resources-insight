// How the verdict ratio behaves as a shape shrinks toward a layer's native
// cell. A coarse and a fine layer of the same quantity are read over the same
// boxes, so the fine layer shows the spread the coarse one can no longer
// resolve.
//
// Requires the dev stack running.
//
//   node docs/measurements/feature-statistics/small-shapes.mjs

import { LAYERS, shapeStats, layerStats, fmt } from './lib.mjs';

const CENTERS = {
  apennineFront: [-2.5, 22.5],
  tranquillitatis: [30, 8],
};
const SIZES = [16, 8, 6, 4, 3, 2, 1, 0.5];
const PAIRS = [
  ['thoriumPrettyman2d', 'thoriumLpHalfDeg'],
  ['feoPrettyman2d', 'feoClementine'],
];

const globalWidth = {};
for (const layer of PAIRS.flat()) {
  const stats = await layerStats(LAYERS[layer].file);
  globalWidth[layer] = stats.percentile_85 - stats.percentile_15;
}

// Native cells covered, with longitude shortened by latitude so a cell count
// means the same area everywhere.
const nativeCells = (layer, size, lat) =>
  (size * Math.cos((lat * Math.PI) / 180) * size) / LAYERS[layer].nativeDeg ** 2;

for (const [center, [lon, lat]] of Object.entries(CENTERS)) {
  for (const [coarse, fine] of PAIRS) {
    console.log(`\n${center}: ${coarse} against ${fine}`);
    console.log('   box   cells  unique  coarse ratio | fine ratio');
    for (const size of SIZES) {
      const box = [lon - size / 2, lat - size / 2, lon + size / 2, lat + size / 2];
      const a = (await shapeStats(LAYERS[coarse].file, box)).b1;
      const b = (await shapeStats(LAYERS[fine].file, box)).b1;
      const ratio = (s, layer) => (s.percentile_85 - s.percentile_15) / globalWidth[layer];
      console.log(
        `  ${String(size).padStart(4)}° ${fmt(nativeCells(coarse, size, lat), 1).padStart(6)} ${String(a.unique).padStart(6)}` +
        ` ${fmt(ratio(a, coarse)).padStart(13)} | ${fmt(ratio(b, fine)).padStart(10)}`,
      );
    }
  }
}
