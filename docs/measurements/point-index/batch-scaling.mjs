// Measures how one /stac/point request scales with the number of assets it
// names, against the point index the generator writes.
//
// Requires the dev stack running and <data>/index/point-index.json present
// (npm run point-index). Asset keys are read from the generated asset list.
//
//   node docs/measurements/point-index/batch-scaling.mjs

import { readFileSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const ITEM = '/data/index/point-index.json';
const COUNTS = [1, 3, 6, 12, 24, 48, 65];
const SAMPLES = 8;

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

const allAssets = JSON.parse(readFileSync(`${DATA_PATH}/index/assets.json`, 'utf8')).assets;

const batchUrl = (assets, lon, lat) =>
  `${BASE}/stac/point/${lon},${lat}?url=${ITEM}&` +
  `${assets.map(name => `assets=${name}`).join('&')}&asset_as_band=true&coord_crs=IAU:30100`;

async function timed(url) {
  const start = performance.now();
  const response = await fetch(url);
  const body = await response.json();
  return { ms: performance.now() - start, status: response.status, body };
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    median: sorted[Math.floor(sorted.length / 2)],
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

console.log(`Point index holds ${allAssets.length} assets, ${SAMPLES} samples per count\n`);
console.log('  assets  median      min      max   per asset');

const medians = new Map();

for (const count of COUNTS) {
  if (count > allAssets.length) continue;
  const assets = allAssets.slice(0, count);
  const samples = [];

  // A distinct coordinate per sample, matching a moving cursor. Point
  // responses are not cached, and distinct coordinates also spread the reads
  // across raster blocks.
  for (let i = 0; i < SAMPLES; i++) {
    const { ms, status } = await timed(batchUrl(assets, -60 + i * 5, 20));
    if (status !== 200) {
      console.error(`  ${count} assets returned HTTP ${status}`);
      process.exit(1);
    }
    samples.push(ms);
  }

  const { median, min, max } = summarise(samples);
  medians.set(count, median);
  console.log(
    `  ${String(count).padStart(6)}  ${median.toFixed(0).padStart(4)}ms  ` +
    `${min.toFixed(0).padStart(5)}ms  ${max.toFixed(0).padStart(5)}ms  ` +
    `${(median / count).toFixed(1).padStart(7)}ms`
  );
}

// Two points on the medians give the marginal cost of an asset and the fixed
// cost of a request, the split batching acts on.
const low = COUNTS[0];
const high = [...medians.keys()].at(-1);
const perAsset = (medians.get(high) - medians.get(low)) / (high - low);
console.log(
  `\n  Between ${low} and ${high} assets: ${perAsset.toFixed(1)}ms per asset, ` +
  `${(medians.get(low) - perAsset * low).toFixed(0)}ms per request`
);
