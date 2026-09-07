// Compares the three forms one scan can take against the point instance: one
// request per layer, one batched request against the full index, and one
// batched request against an item holding only the selected layers.
//
// The last form is the floor for the batched form. The gap between the two is
// what the index costs for the assets it carries.
//
// Requires the dev stack running and <data>/index/point-index.json present.
// SCAN_SIZE sets the number of layers, up to six.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/point-index/batch-vs-separate.mjs

import { readFileSync, writeFileSync, rmSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const SAMPLES = 10;

// One scan selection: layers that all cover the whole Moon. SCAN_SIZE takes the
// first n, which is how many layers the scanner has selected.
const SELECTION = [
  'iron5d',
  'calcium5d',
  'magnesium5d',
  'aluminum5d',
  'oxygen5d',
  'potassium2d',
];

const SCAN = SELECTION.slice(0, Number(process.env.SCAN_SIZE ?? SELECTION.length));

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(`${DATA_PATH}/index/point-index.json`, 'utf8'));

// The tiler holds a parsed item against its path with no expiry, so an item
// whose asset list differs needs a path the process has not read before.
const PROBE = `_probe_scan_${SCAN.length}_assets.json`;

writeFileSync(`${DATA_PATH}/${PROBE}`, JSON.stringify({
  ...index,
  id: `probe-scan-${SCAN.length}`,
  assets: Object.fromEntries(SCAN.map(key => [key, index.assets[key]])),
}));

const separateUrl = (key, lon, lat) =>
  `${BASE}/cog/point/${lon},${lat}?url=${index.assets[key].href}&bidx=1&coord_crs=IAU:30100`;

const batchedUrl = (item, lon, lat) =>
  `${BASE}/stac/point/${lon},${lat}?url=${item}&` +
  `${SCAN.map(key => `assets=${key}`).join('&')}&asset_as_band=true&coord_crs=IAU:30100`;

async function timed(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// A failed request would otherwise be timed as a fast response carrying an
// error body.
async function drain(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}\n  ${JSON.stringify(body)}`);
  return body;
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, value) => sum + value, 0) / sorted.length;
  return `median=${sorted[Math.floor(sorted.length / 2)].toFixed(0)}ms ` +
    `mean=${mean.toFixed(0)}ms min=${sorted[0].toFixed(0)}ms max=${sorted.at(-1).toFixed(0)}ms`;
}

try {
  const separate = [];
  const fullIndex = [];
  const scanItem = [];

  // Interleaved, so host load moves all three together.
  for (let i = 0; i < SAMPLES; i++) {
    const lon = -60 + i * 5;
    separate.push(await timed(() => Promise.all(SCAN.map(key => drain(separateUrl(key, lon, 20))))));
    fullIndex.push(await timed(() => drain(batchedUrl('/data/index/point-index.json', lon, 20))));
    scanItem.push(await timed(() => drain(batchedUrl(`/data/${PROBE}`, lon, 20))));
  }

  console.log(`One ${SCAN.length}-layer scan, ${SAMPLES} samples\n`);
  console.log(`  ${SCAN.length} separate /cog/point   ${summarise(separate)}`);
  console.log(`  batched, ${Object.keys(index.assets).length}-asset index  ${summarise(fullIndex)}`);
  console.log(`  batched, ${SCAN.length}-asset item     ${summarise(scanItem)}`);
} finally {
  rmSync(`${DATA_PATH}/${PROBE}`, { force: true });
}
