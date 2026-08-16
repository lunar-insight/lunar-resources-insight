// Measures /cog/point latency in isolation and while the tiler renders tiles.
//
// Requires the dev stack to be running (docker compose up) and the layer files
// below to exist under the tiler's /data mount.
//
//   node docs/measurements/scanner-latency/point-latency.mjs

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173/cog';

const LAYERS = [
  '/data/chemical_elements/iron/iron5d_COG.tif',
  '/data/chemical_elements/calcium/calcium5d_COG.tif',
  '/data/chemical_elements/magnesium/magnesium5d_COG.tif',
  '/data/chemical_elements/aluminum/aluminum5d_COG.tif',
  '/data/chemical_elements/oxygen/oxygen5d_COG.tif',
  '/data/chemical_elements/potassium/potassium2d_COG.tif',
];

const pointUrl = (file, lon, lat) =>
  `${BASE}/point/${lon},${lat}?url=${file}&bidx=1&coord_crs=IAU:30100`;

const tileUrl = (file, z, x, y) =>
  `${BASE}/tiles/MoonGeographicSphere/${z}/${x}/${y}?url=${file}&bidx=1`;

async function timed(url) {
  const start = performance.now();
  const response = await fetch(url);
  await response.arrayBuffer();
  return { ms: performance.now() - start, status: response.status };
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    n: sorted.length,
    mean: mean.toFixed(0),
    median: sorted[Math.floor(sorted.length / 2)].toFixed(0),
    min: sorted[0].toFixed(0),
    max: sorted[sorted.length - 1].toFixed(0),
  };
}

const report = (label, samples) => {
  const s = summarise(samples);
  console.log(`  ${label.padEnd(34)} n=${s.n} mean=${s.mean}ms median=${s.median}ms min=${s.min}ms max=${s.max}ms`);
};

// Spreads tile requests over two zoom levels, approximating a globe navigation
// burst. Returns a promise that settles when every tile has been served.
function startTileLoad(file) {
  const tiles = [];
  for (let z = 4; z <= 5; z++) {
    for (let x = 0; x < 6; x++) {
      for (let y = 1; y <= 2; y++) tiles.push(tileUrl(file, z, x, y));
    }
  }
  return Promise.allSettled(tiles.map(url => fetch(url).then(r => r.arrayBuffer())));
}

console.log('1. Single point request, one layer, idle tiler');
const sequential = [];
for (let i = 0; i < 20; i++) {
  const { ms } = await timed(pointUrl(LAYERS[0], -30 + i * 0.7, 10));
  sequential.push(ms);
}
report('sequential, same layer', sequential);

console.log('\n2. One scan batch: all layers requested concurrently');
const batchStart = performance.now();
const batch = await Promise.all(LAYERS.map(f => timed(pointUrl(f, 12, 10))));
console.log(`  batch wall clock: ${(performance.now() - batchStart).toFixed(0)}ms`);
report('per request within the batch', batch.map(r => r.ms));

console.log('\n3. Point latency while 24 tiles render');
const idleBaseline = [];
for (let i = 0; i < 5; i++) idleBaseline.push((await timed(pointUrl(LAYERS[0], i, 10))).ms);
report('baseline, idle tiler', idleBaseline);

const load = startTileLoad(LAYERS[0]);
const underLoad = [];
for (let i = 0; i < 5; i++) underLoad.push((await timed(pointUrl(LAYERS[0], i, 11))).ms);
await load;
report('during tile load', underLoad);

console.log('\n4. Tile response cache headers');
const tileResponse = await fetch(tileUrl(LAYERS[0], 3, 4, 2));
await tileResponse.arrayBuffer();
for (const header of ['cache-control', 'etag', 'expires', 'last-modified']) {
  console.log(`  ${header.padEnd(16)} ${tileResponse.headers.get(header) ?? '(absent)'}`);
}

console.log('\n5. Response shape for each outcome');
const cases = [
  ['value present', pointUrl(LAYERS[0], 0, 0)],
  ['nodata inside raster', pointUrl('/data/chemical_elements/iron/iron_ch2_class_COG.tif', 45, 20)],
  ['invalid coordinates', pointUrl(LAYERS[0], 500, 500)],
  ['tile outside bounds', tileUrl(LAYERS[0], 12, 9999, 9999)],
];
for (const [label, url] of cases) {
  const response = await fetch(url);
  const body = (await response.text()).slice(0, 80);
  console.log(`  ${label.padEnd(22)} ${response.status}  ${body}`);
}
