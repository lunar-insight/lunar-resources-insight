// What one shape request returns, what it needs, and what percentiles and
// resolution cost.
//
// Requires the dev stack running.
//
//   node docs/measurements/feature-statistics/shape-request.mjs

import { LAYERS, SHAPES, shapeStats, median, fmt } from './lib.mjs';

const SAMPLES = 8;

// 1. The CRS requirement and the response fields.
{
  const without = await shapeStats(LAYERS.thoriumPrettyman2d.file, SHAPES.imbrium, { crs: null });
  const withCrs = await shapeStats(LAYERS.thoriumPrettyman2d.file, SHAPES.imbrium);
  console.log('Shape CRS');
  console.log(`  no coord_crs      HTTP ${without.status}`);
  console.log(`  coord_crs Moon    HTTP ${withCrs.status}`);
  console.log(`  fields: ${Object.keys(withCrs.b1).join(', ')}\n`);
}

// 2. Percentile cost, interleaved so host load moves the three forms together.
const PERCENTILE_SETS = { none: [], two: [15, 85], five: [5, 15, 50, 85, 95] };
const COST_CASES = [
  ['thoriumPrettyman2d', SHAPES.imbrium, 1024],
  ['ironCh2Class', [-40, -10, 0, 40], 1024],
  ['feoClementine', [25, 3, 30, 8], null],
];

console.log(`Percentile cost, median of ${SAMPLES}`);
console.log('  layer                 pixels     none    two   five');
for (const [layer, box, maxSize] of COST_CASES) {
  const times = { none: [], two: [], five: [] };
  let count = 0;
  await shapeStats(LAYERS[layer].file, box, { maxSize });
  for (let i = 0; i < SAMPLES; i++) {
    for (const [name, p] of Object.entries(PERCENTILE_SETS)) {
      const result = await shapeStats(LAYERS[layer].file, box, { p, maxSize });
      times[name].push(result.ms);
      count = result.b1.count;
    }
  }
  console.log(
    `  ${layer.padEnd(20)} ${String(Math.round(count)).padStart(8)}` +
    ['none', 'two', 'five'].map(name => `${median(times[name]).toFixed(0).padStart(6)}ms`).join(''),
  );
}

// 3. Read size on a 100 m layer. Values and time for growing boxes at full
// resolution and capped reads.
console.log(`\nRead size on Clementine FeO, median of 3`);
console.log('  box   max_size     pixels      time    mean     p15     p85');
for (const size of [2, 5, 8]) {
  const box = [25, 3, 25 + size, 3 + size];
  for (const maxSize of [null, 2048, 1024, 512]) {
    const times = [];
    let b1;
    for (let i = 0; i < 3; i++) {
      const result = await shapeStats(LAYERS.feoClementine.file, box, { maxSize });
      if (result.status !== 200) {
        console.log(`  ${size}°    ${String(maxSize ?? 'full').padStart(8)}  HTTP ${result.status}`);
        break;
      }
      times.push(result.ms);
      b1 = result.b1;
    }
    if (!b1) continue;
    console.log(
      `  ${String(size).padStart(2)}°  ${String(maxSize ?? 'full').padStart(8)} ${String(Math.round(b1.count)).padStart(10)}` +
      ` ${median(times).toFixed(0).padStart(7)}ms ${fmt(b1.mean).padStart(7)} ${fmt(b1.percentile_15).padStart(7)} ${fmt(b1.percentile_85).padStart(7)}`,
    );
  }
}

// 4. Extremes under a capped read. A capped read comes from overviews, which
// average pixels, so the extremes are where it can differ.
const EXTREME_CASES = [
  ['feoClementine', [25, 3, 33, 11]],
  ['feoClementine', [47, 5, 55, 13]],
  ['plagioclaseKaguyaMi', [155, 5, 163, 13]],
];
console.log('\nExtremes under a capped read, 8° boxes');
console.log('  layer                 max_size     min     max      p1     p99    mean');
for (const [layer, box] of EXTREME_CASES) {
  for (const maxSize of [null, 1024, 512]) {
    const b = (await shapeStats(LAYERS[layer].file, box, { maxSize, p: [1, 15, 85, 99] })).b1;
    console.log(
      `  ${layer.padEnd(20)} ${String(maxSize ?? 'full').padStart(8)}` +
      [b.min, b.max, b.percentile_1, b.percentile_99, b.mean].map(v => fmt(v).padStart(8)).join(''),
    );
  }
}
