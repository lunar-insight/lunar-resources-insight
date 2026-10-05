// How far a mean over part of a shape lands from the mean over all of it.
//
// Partial coverage is simulated on layers that cover the whole Moon: each box
// is cut from one side so the kept part holds a given share of its area, the
// way a dataset edge or a nodata region removes a contiguous part. The error
// is expressed as a share of the layer's whole Moon p15 to p85 width, the
// same unit as the verdict ratio.
//
// Requires the dev stack running.
//
//   node docs/measurements/feature-statistics/partial-coverage.mjs

import { LAYERS, SHAPES, shapeStats, layerStats, median, fmt } from './lib.mjs';

const RUN_LAYERS = ['thoriumLpHalfDeg', 'hydrogenLawrence', 'feoPrettyman2d', 'feoClementine'];
const FRACTIONS = [0.9, 0.7, 0.5, 0.3, 0.1];
const SIDES = ['north', 'south', 'east', 'west'];

const rad = deg => (deg * Math.PI) / 180;
const deg = r => (r * 180) / Math.PI;

// Keeps the share f of the box's area, measured on the sphere, removing the
// rest from one side.
function cut([w, s, e, n], side, f) {
  if (side === 'east') return [w, s, w + (e - w) * f, n];
  if (side === 'west') return [e - (e - w) * f, s, e, n];
  const sinS = Math.sin(rad(s));
  const sinN = Math.sin(rad(n));
  if (side === 'north') return [w, s, e, deg(Math.asin(sinS + (sinN - sinS) * f))];
  return [w, deg(Math.asin(sinN - (sinN - sinS) * f)), e, n];
}

const errors = {};
for (const layer of RUN_LAYERS) {
  const stats = await layerStats(LAYERS[layer].file);
  const width = stats.percentile_85 - stats.percentile_15;
  errors[layer] = Object.fromEntries(FRACTIONS.map(f => [f, []]));

  for (const box of Object.values(SHAPES)) {
    const full = (await shapeStats(LAYERS[layer].file, box, { p: [] })).b1.mean;
    for (const f of FRACTIONS) {
      for (const side of SIDES) {
        const part = (await shapeStats(LAYERS[layer].file, cut(box, side, f), { p: [] })).b1.mean;
        errors[layer][f].push(Math.abs(part - full) / width);
      }
    }
  }
}

const shapeCount = Object.keys(SHAPES).length;
console.log(`Error of a partial mean, share of the whole Moon p15 to p85 width`);
console.log(`${shapeCount} shapes x ${SIDES.length} sides per cell, median / max\n`);
console.log(`  layer              ${FRACTIONS.map(f => `${Math.round(f * 100)}% kept`.padStart(13)).join('')}`);
for (const layer of RUN_LAYERS) {
  console.log(
    `  ${layer.padEnd(18)}` +
    FRACTIONS.map(f => `${fmt(median(errors[layer][f]))} / ${fmt(Math.max(...errors[layer][f]))}`.padStart(13)).join(''),
  );
}
const all = f => RUN_LAYERS.flatMap(layer => errors[layer][f]);
console.log(
  `  ${'all layers'.padEnd(18)}` +
  FRACTIONS.map(f => `${fmt(median(all(f)))} / ${fmt(Math.max(...all(f)))}`.padStart(13)).join(''),
);
