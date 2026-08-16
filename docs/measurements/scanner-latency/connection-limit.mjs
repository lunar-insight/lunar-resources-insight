// Tests what a scan costs when it competes with tile loading for a browser's
// connection pool.
//
// A browser allows six concurrent connections per origin, and this application
// serves the app, tiles and point queries from one origin over HTTP/1.1. A scan
// issuing one request per layer therefore takes the whole pool, while a scan
// issued as a single multi-asset request takes one slot. Node applies no such
// limit, so the other scripts here cannot show the difference.
//
// The limit is modelled with a FIFO semaphore over every request, tiles and
// scan alike, because they share one pool in a browser. Tile coordinates are
// unique per sample so tiles always reach the tiler.
//
// Requires the development stack running, a /stac/point route on the proxy, and
// DATA_PATH pointing at the host directory mounted as /data in the tiler, the
// same value the tiler's compose file uses.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/scanner-latency/connection-limit.mjs

import { writeFileSync, rmSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const CONNECTIONS = Number(process.env.CONNECTIONS ?? 6);
const TILES_IN_FLIGHT = 24;
const SAMPLES = 10;

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

const LAYERS = {
  iron: 'chemical_elements/iron/iron5d_COG.tif',
  calcium: 'chemical_elements/calcium/calcium5d_COG.tif',
  magnesium: 'chemical_elements/magnesium/magnesium5d_COG.tif',
  aluminum: 'chemical_elements/aluminum/aluminum5d_COG.tif',
  oxygen: 'chemical_elements/oxygen/oxygen5d_COG.tif',
  potassium: 'chemical_elements/potassium/potassium2d_COG.tif',
};

const PROBE_NAME = '_connection_limit_probe.json';
const probeHostPath = `${DATA_PATH}/${PROBE_NAME}`;

function writeProbeItem() {
  writeFileSync(probeHostPath, JSON.stringify({
    type: 'Feature',
    stac_version: '1.0.0',
    id: 'connection-limit-probe',
    geometry: {
      type: 'Polygon',
      coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
    },
    bbox: [-180, -90, 180, 90],
    properties: { datetime: '2026-01-01T00:00:00Z' },
    links: [],
    assets: Object.fromEntries(Object.entries(LAYERS).map(([name, path]) => [
      name, { href: `/data/${path}`, type: 'image/tiff; application=geotiff' },
    ])),
  }, null, 1));
}

// Caps concurrent requests and queues the rest in arrival order, which is how a
// browser treats an origin once its connections are busy.
function createLimiter(limit) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= limit || queue.length === 0) return;
    active++;
    const { run, resolve, reject } = queue.shift();
    run().then(resolve, reject).finally(() => { active--; next(); });
  };
  return run => new Promise((resolve, reject) => {
    queue.push({ run, resolve, reject });
    next();
  });
}

const pointUrl = (path, lon) =>
  `${BASE}/cog/point/${lon},10?url=/data/${path}&bidx=1&coord_crs=IAU:30100`;

const assetQuery = Object.keys(LAYERS).map(name => `assets=${name}`).join('&');
const batchedUrl = lon =>
  `${BASE}/stac/point/${lon},10?url=/data/${PROBE_NAME}&${assetQuery}&coord_crs=IAU:30100`;

const tileUrl = (z, x, y) =>
  `${BASE}/cog/tiles/MoonGeographicSphere/${z}/${x}/${y}?url=/data/${LAYERS.iron}&bidx=1`;

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return `median=${sorted[Math.floor(sorted.length / 2)].toFixed(0)}ms mean=${mean.toFixed(0)}ms ` +
         `min=${sorted[0].toFixed(0)}ms max=${sorted[sorted.length - 1].toFixed(0)}ms`;
}

// Issues a tile burst and a scan through one pool, and times the scan alone.
async function sample(limiter, scan, tileOffset) {
  const tiles = [];
  for (let i = 0; i < TILES_IN_FLIGHT; i++) {
    const z = 6;
    const x = (tileOffset * TILES_IN_FLIGHT + i) % 64;
    const y = 10 + (tileOffset % 8);
    tiles.push(limiter(() => fetch(tileUrl(z, x, y)).then(r => r.arrayBuffer())).catch(() => {}));
  }

  const start = performance.now();
  await scan(limiter, tileOffset);
  const elapsed = performance.now() - start;

  await Promise.allSettled(tiles);
  return elapsed;
}

const separateScan = (limiter, lon) =>
  Promise.all(Object.values(LAYERS).map(p =>
    limiter(() => fetch(pointUrl(p, lon % 60)).then(r => r.json()))));

const batchedScan = (limiter, lon) =>
  limiter(() => fetch(batchedUrl(lon % 60)).then(r => r.json()));

writeProbeItem();

try {
  const separate = [];
  const batched = [];

  // A fresh limiter per sample, so a previous sample's queue cannot carry over.
  for (let i = 0; i < SAMPLES; i++) {
    separate.push(await sample(createLimiter(CONNECTIONS), separateScan, i * 2));
    batched.push(await sample(createLimiter(CONNECTIONS), batchedScan, i * 2 + 1));
  }

  console.log(`Scan latency while ${TILES_IN_FLIGHT} tiles load, sharing a pool of ` +
              `${CONNECTIONS} connections, ${SAMPLES} samples\n`);
  console.log(`  ${Object.keys(LAYERS).length} separate requests  ${summarise(separate)}`);
  console.log(`  1 batched request     ${summarise(batched)}`);
} finally {
  rmSync(probeHostPath, { force: true });
}
