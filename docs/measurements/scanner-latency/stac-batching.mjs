// Compares one scan batch issued as separate per-layer requests against the
// same batch issued as a single multi-asset request.
//
//   separate: one /cog/point request per layer, in parallel
//   batched:  one /stac/point request naming every layer as an asset
//
// A STAC item grouping the layers is written to the raster directory for the
// duration of the run and removed afterwards, because the tiler reads the item
// from its own mount and no such item exists in the catalogue.
//
// Requires the development stack running, a /stac/point route on the proxy, and
// DATA_PATH pointing at the host directory mounted as /data in the tiler, the
// same value the tiler's compose file uses.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/scanner-latency/stac-batching.mjs
//
// The tiler caches a parsed STAC item against its URL. Editing the asset list
// while keeping the same filename serves the previous version until the tiler
// restarts, which surfaces as a 404 for an asset the item now contains.

import { writeFileSync, rmSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const SAMPLES = 8;

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

// Layer name to path under the tiler's /data mount. These six stand in for one
// scan batch and all cover the whole Moon.
const LAYERS = {
  iron: 'chemical_elements/iron/iron5d_COG.tif',
  calcium: 'chemical_elements/calcium/calcium5d_COG.tif',
  magnesium: 'chemical_elements/magnesium/magnesium5d_COG.tif',
  aluminum: 'chemical_elements/aluminum/aluminum5d_COG.tif',
  oxygen: 'chemical_elements/oxygen/oxygen5d_COG.tif',
  potassium: 'chemical_elements/potassium/potassium2d_COG.tif',
};

// Carried in the item but excluded from the timed batch. This raster holds
// nodata inside its footprint and sits on a different grid to the six above,
// which the coverage check at the end relies on.
const PARTIAL_COVERAGE_LAYER = {
  ironclass: 'chemical_elements/iron/iron_ch2_class_COG.tif',
};

const PROBE_NAME = '_stac_batch_probe.json';
const probeHostPath = `${DATA_PATH}/${PROBE_NAME}`;

function writeProbeItem() {
  const item = {
    type: 'Feature',
    stac_version: '1.0.0',
    id: 'scanner-batch-probe',
    geometry: {
      type: 'Polygon',
      coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
    },
    bbox: [-180, -90, 180, 90],
    properties: { datetime: '2026-01-01T00:00:00Z' },
    links: [],
    assets: Object.fromEntries(
      Object.entries({ ...LAYERS, ...PARTIAL_COVERAGE_LAYER }).map(([name, path]) => [
        name,
        { href: `/data/${path}`, type: 'image/tiff; application=geotiff' },
      ])
    ),
  };
  writeFileSync(probeHostPath, JSON.stringify(item, null, 1));
}

const separateUrl = (path, lon, lat) =>
  `${BASE}/cog/point/${lon},${lat}?url=/data/${path}&bidx=1&coord_crs=IAU:30100`;

const batchedUrl = (lon, lat, names = Object.keys(LAYERS)) =>
  `${BASE}/stac/point/${lon},${lat}?url=/data/${PROBE_NAME}&` +
  `${names.map(name => `assets=${name}`).join('&')}&coord_crs=IAU:30100`;

async function timed(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

// Surfaces a failed request. An error body would otherwise reach the caller as
// a response object carrying no values.
async function getJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}\n  ${JSON.stringify(body)}`);
  }
  return body;
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return `median=${median.toFixed(0)}ms min=${sorted[0].toFixed(0)}ms max=${sorted[sorted.length - 1].toFixed(0)}ms`;
}

writeProbeItem();

try {
  const separate = [];
  const batched = [];

  for (let i = 0; i < SAMPLES; i++) {
    separate.push(await timed(() =>
      Promise.all(Object.values(LAYERS).map(p => fetch(separateUrl(p, i, 10)).then(r => r.json())))
    ));
    batched.push(await timed(() => fetch(batchedUrl(i, 10)).then(r => r.json())));
  }

  console.log(`One scan batch of ${Object.keys(LAYERS).length} layers, ${SAMPLES} samples\n`);
  console.log(`  separate requests  ${summarise(separate)}`);
  console.log(`  one batched request ${summarise(batched)}`);

  const response = await getJson(batchedUrl(3, 10));
  console.log('\nBatched response shape:');
  console.log(`  values            ${JSON.stringify(response.values)}`);
  console.log(`  band_descriptions ${JSON.stringify(response.band_descriptions)}`);

  // A layer holding no data at the point returns null in its position while the
  // others carry values, so one response distinguishes both outcomes per layer.
  // The two assets requested here also sit on different grids, which a point
  // query does not require to match.
  const names = ['iron', ...Object.keys(PARTIAL_COVERAGE_LAYER)];
  const mixed = await getJson(batchedUrl(45, 20, names));
  console.log(`\nCoverage check at a point one asset does not hold data for:`);
  console.log(`  assets ${JSON.stringify(names)}`);
  console.log(`  values ${JSON.stringify(mixed.values)}`);
} finally {
  rmSync(probeHostPath, { force: true });
}
