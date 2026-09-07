// Tests what the tiler keeps between requests: whether a rewritten item is
// seen, what a restart changes, and what the first request after a restart
// costs.
//
// Restarts the point instance. Requires the dev stack running and docker on the
// path.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/point-index/item-cache.mjs

import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';
const DATA_PATH = process.env.DATA_PATH;
const PROBE = '_probe_cache.json';
const POINT_INSTANCE = 'planetcantile-point';
const FIRST = 'iron5d';
const ADDED = 'calcium5d';

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

const index = JSON.parse(readFileSync(`${DATA_PATH}/index/point-index.json`, 'utf8'));

const writeProbe = keys => writeFileSync(
  `${DATA_PATH}/${PROBE}`,
  JSON.stringify({ ...index, id: 'probe-cache', assets: Object.fromEntries(keys.map(k => [k, index.assets[k]])) })
);

const probeUrl = (asset, lon) =>
  `${BASE}/stac/point/${lon},20?url=/data/${PROBE}&assets=${asset}&asset_as_band=true&coord_crs=IAU:30100`;

const indexUrl = lon =>
  `${BASE}/stac/point/${lon},20?url=/data/index/point-index.json&assets=${FIRST}&asset_as_band=true&coord_crs=IAU:30100`;

// Reaches the same instance without touching a STAC item, so it reports the
// process being back up without paying the cost under measurement.
const readyUrl = `${BASE}/cog/point/0,0?url=${index.assets[FIRST].href}&bidx=1&coord_crs=IAU:30100`;

async function timed(url) {
  const start = performance.now();
  const response = await fetch(url);
  await response.json();
  return { ms: performance.now() - start, status: response.status };
}

async function restartPointInstance() {
  const names = execFileSync('docker', ['ps', '--filter', `name=${POINT_INSTANCE}`, '--format', '{{.Names}}'],
    { encoding: 'utf8' }).split('\n').map(n => n.trim()).filter(Boolean);
  if (names.length === 0) throw new Error(`no running container matching ${POINT_INSTANCE}`);
  execFileSync('docker', ['restart', ...names], { stdio: ['ignore', 'pipe', 'pipe'] });

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const { status } = await timed(readyUrl).catch(() => ({ status: 0 }));
    if (status === 200) return names.join(', ');
  }
  throw new Error('point instance did not come back');
}

try {
  writeProbe([FIRST]);
  console.log(`item holds [${FIRST}]`);
  console.log(`  request ${FIRST}  HTTP ${(await timed(probeUrl(FIRST, 10))).status}`);

  writeProbe([FIRST, ADDED]);
  console.log(`\nsame path rewritten, item now holds [${FIRST}, ${ADDED}]`);
  console.log(`  request ${ADDED}  HTTP ${(await timed(probeUrl(ADDED, 11))).status}`);

  console.log(`\nrestarted ${await restartPointInstance()}`);
  console.log(`  request ${ADDED}  HTTP ${(await timed(probeUrl(ADDED, 12))).status}`);

  // The process is already up and rasterio imported, so this isolates reading
  // and parsing the index against the requests that follow it.
  const cold = await timed(indexUrl(20));
  const warm = [];
  for (let i = 0; i < 5; i++) warm.push((await timed(indexUrl(21 + i))).ms);
  warm.sort((a, b) => a - b);

  console.log(`\n${Object.keys(index.assets).length}-asset index, one asset requested`);
  console.log(`  first request after restart  ${cold.ms.toFixed(0)}ms`);
  console.log(`  median of the next 5         ${warm[2].toFixed(0)}ms`);
} finally {
  rmSync(`${DATA_PATH}/${PROBE}`, { force: true });
}
