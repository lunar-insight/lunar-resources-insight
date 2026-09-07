// Measures what an asset costs a request that does not name it, by requesting
// one asset from items of increasing size.
//
// Probe items are written beside the index for the duration of the run and
// removed afterwards. Each has a distinct path, so each gets its own entry in
// the tiler's item cache.
//
// Requires the dev stack running and <data>/index/point-index.json present.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/point-index/item-size.mjs

import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const SIZES = [1, 6, 12, 24, 48, 65];
const SAMPLES = 8;
// Named by every request, so only the size of the item around it changes.
const ASSET = 'iron5d';

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(`${DATA_PATH}/index/point-index.json`, 'utf8'));
const otherKeys = Object.keys(index.assets).filter(key => key !== ASSET);

const probeName = size => `_probe_${size}_assets.json`;

function writeProbe(size) {
  const keys = [ASSET, ...otherKeys.slice(0, size - 1)];
  const item = {
    ...index,
    id: `probe-${size}`,
    assets: Object.fromEntries(keys.map(key => [key, index.assets[key]])),
  };
  writeFileSync(`${DATA_PATH}/${probeName(size)}`, JSON.stringify(item));
}

const probeUrl = (size, lon, lat) =>
  `${BASE}/stac/point/${lon},${lat}?url=/data/${probeName(size)}&` +
  `assets=${ASSET}&asset_as_band=true&coord_crs=IAU:30100`;

async function timed(url) {
  const start = performance.now();
  const response = await fetch(url);
  await response.json();
  return { ms: performance.now() - start, status: response.status };
}

const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

try {
  console.log(`One asset requested, ${SAMPLES} samples per item size\n`);
  console.log('  assets in item  median  per carried asset');

  const medians = new Map();

  for (const size of SIZES) {
    writeProbe(size);

    // The first request reads and caches the item file, a cost the following
    // samples do not carry.
    await timed(probeUrl(size, -70, 20));

    const samples = [];
    for (let i = 0; i < SAMPLES; i++) {
      const { ms, status } = await timed(probeUrl(size, -60 + i * 5, 20));
      if (status !== 200) {
        console.error(`  item of ${size} assets returned HTTP ${status}`);
        process.exit(1);
      }
      samples.push(ms);
    }

    medians.set(size, median(samples));
    console.log(
      `  ${String(size).padStart(14)}  ${medians.get(size).toFixed(0).padStart(4)}ms` +
      `  ${((medians.get(size) - medians.get(SIZES[0])) / Math.max(size - SIZES[0], 1)).toFixed(1).padStart(11)}ms`
    );
  }

  const first = SIZES[0];
  const last = SIZES.at(-1);
  const slope = (medians.get(last) - medians.get(first)) / (last - first);
  console.log(
    `\n  A carried asset costs ${slope.toFixed(1)}ms per request, ` +
    `${((medians.get(last) - medians.get(first))).toFixed(0)}ms across the whole index`
  );
} finally {
  for (const size of SIZES) rmSync(`${DATA_PATH}/${probeName(size)}`, { force: true });
}
