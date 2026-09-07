// Measures concurrent batched point requests against the single-worker point
// instance, which sets whether a scan can keep more than one batch in flight.
//
// Requires the dev stack running and <data>/index/point-index.json present.
//
//   node docs/measurements/point-index/concurrency.mjs

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const ITEM = '/data/index/point-index.json';
const CONCURRENCY = [1, 2, 4, 6];
const ROUNDS = 5;

const SCAN = [
  'iron5d',
  'calcium5d',
  'magnesium5d',
  'aluminum5d',
  'oxygen5d',
  'potassium2d',
];

const batchUrl = lon =>
  `${BASE}/stac/point/${lon},20?url=${ITEM}&` +
  `${SCAN.map(key => `assets=${key}`).join('&')}&asset_as_band=true&coord_crs=IAU:30100`;

async function timed(url) {
  const start = performance.now();
  const response = await fetch(url);
  await response.json();
  return { ms: performance.now() - start, status: response.status };
}

const median = samples => [...samples].sort((a, b) => a - b)[Math.floor(samples.length / 2)];

console.log(`${SCAN.length} assets per request, ${ROUNDS} rounds\n`);
console.log('  in flight  per request  group wall clock  per request in group');

for (const count of CONCURRENCY) {
  const perRequest = [];
  const wallClock = [];

  for (let round = 0; round < ROUNDS; round++) {
    const lon = -60 + round * 5;
    const start = performance.now();
    const results = await Promise.all(
      Array.from({ length: count }, (_, i) => timed(batchUrl(lon + i * 0.1)))
    );
    wallClock.push(performance.now() - start);
    for (const result of results) {
      if (result.status !== 200) {
        console.error(`  HTTP ${result.status} at concurrency ${count}`);
        process.exit(1);
      }
      perRequest.push(result.ms);
    }
  }

  const group = median(wallClock);
  console.log(
    `  ${String(count).padStart(9)}  ${median(perRequest).toFixed(0).padStart(9)}ms` +
    `  ${group.toFixed(0).padStart(14)}ms  ${(group / count).toFixed(0).padStart(18)}ms`
  );
}
