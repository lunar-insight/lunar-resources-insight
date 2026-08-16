// Compares two scanner dispatch strategies against the running tiler.
//
//   serialised: the batch for a stale position runs to completion before the
//               batch for the current position starts.
//   preempting: the stale batch is aborted once the throttle interval elapses,
//               and the current position is requested immediately.
//
// Both replay the same gesture: a batch goes out for position A, the cursor
// moves to B after 50ms and stops. The metric is the delay between settling on
// B and holding B's values.
//
// Requires the dev stack to be running (docker compose up).
//
//   node docs/measurements/scanner-latency/dispatch-comparison.mjs

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173/cog';

const LAYERS = [
  '/data/chemical_elements/iron/iron5d_COG.tif',
  '/data/chemical_elements/calcium/calcium5d_COG.tif',
  '/data/chemical_elements/magnesium/magnesium5d_COG.tif',
  '/data/chemical_elements/aluminum/aluminum5d_COG.tif',
  '/data/chemical_elements/oxygen/oxygen5d_COG.tif',
];

// Mirrors PointValueService.fetchThrottleMs and a plausible cursor gesture.
const THROTTLE_MS = 100;
const MOVE_AT_MS = 50;
const SAMPLES = 5;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const pointUrl = (file, lon, lat) =>
  `${BASE}/point/${lon},${lat}?url=${file}&bidx=1&coord_crs=IAU:30100`;

const batch = (lon, lat, signal) =>
  Promise.allSettled(LAYERS.map(f => fetch(pointUrl(f, lon, lat), { signal }).then(r => r.json())));

function startTileLoad(signal) {
  const tiles = [];
  for (let z = 4; z <= 5; z++) {
    for (let x = 0; x < 6; x++) {
      for (let y = 1; y <= 2; y++) {
        tiles.push(
          fetch(`${BASE}/tiles/MoonGeographicSphere/${z}/${x}/${y}?url=${LAYERS[0]}&bidx=1`, { signal })
            .then(r => r.arrayBuffer())
            .catch(() => {})
        );
      }
    }
  }
  return Promise.allSettled(tiles);
}

async function serialised(posA, posB) {
  const stale = batch(posA[0], posA[1]);
  await sleep(MOVE_AT_MS);
  const settled = performance.now();
  await stale;
  await batch(posB[0], posB[1]);
  return performance.now() - settled;
}

async function preempting(posA, posB) {
  const controller = new AbortController();
  const stale = batch(posA[0], posA[1], controller.signal).catch(() => {});
  await sleep(MOVE_AT_MS);
  const settled = performance.now();
  await sleep(THROTTLE_MS - MOVE_AT_MS);
  controller.abort();
  await stale;
  await batch(posB[0], posB[1]);
  return performance.now() - settled;
}

async function run(label, strategy, underLoad) {
  const samples = [];
  for (let i = 0; i < SAMPLES; i++) {
    const stop = new AbortController();
    const load = underLoad ? startTileLoad(stop.signal) : null;
    samples.push(await strategy([10 + i, 5], [20 + i, 6]));
    stop.abort();
    if (load) await load;
    await sleep(200);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((sum, v) => sum + v, 0) / samples.length;
  console.log(
    `  ${label.padEnd(14)} mean=${mean.toFixed(0)}ms median=${samples[Math.floor(SAMPLES / 2)].toFixed(0)}ms ` +
    `min=${samples[0].toFixed(0)}ms max=${samples[SAMPLES - 1].toFixed(0)}ms`
  );
}

console.log('Delay between the cursor settling on a point and its values arriving\n');
console.log('IDLE TILER');
await run('serialised', serialised, false);
await run('preempting', preempting, false);

console.log('\nDURING TILE LOAD');
await run('serialised', serialised, true);
await run('preempting', preempting, true);
