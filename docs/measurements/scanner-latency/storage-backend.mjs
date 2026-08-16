// Tests whether raster storage accounts for point query latency.
//
// The rasters are bind-mounted from a Windows host path, which reaches the
// container through Docker Desktop's filesystem translation layer. This copies
// them into the point instance's tmpfs, which is container RAM and therefore
// the fastest storage available to it, and times the same queries against both
// locations. Samples are interleaved so drift affects both equally.
//
// A tmpfs result matching the bind-mount result rules storage out, because RAM
// is the floor no other storage can beat.
//
// Requires the development stack running. DATA_PATH is the host directory
// mounted as /data in the tiler, the same value the tiler's compose file uses.
//
//   DATA_PATH=<host raster directory> \
//     node docs/measurements/scanner-latency/storage-backend.mjs

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const BASE = process.env.TILER_BASE ?? 'http://localhost:5173/cog/point';
const DATA_PATH = process.env.DATA_PATH;
const CONTAINER = process.env.POINT_CONTAINER ?? 'planetcantile-planetcantile-point-1';
const TMPFS_DIR = '/tmp/cogs';
const SINGLE_SAMPLES = 24;
const BATCH_SAMPLES = 12;

if (!DATA_PATH) {
  console.error('DATA_PATH must point at the host directory mounted as /data.');
  process.exit(1);
}

// Layer name to path under the tiler's /data mount.
const LAYERS = {
  iron: 'chemical_elements/iron/iron5d_COG.tif',
  calcium: 'chemical_elements/calcium/calcium5d_COG.tif',
  magnesium: 'chemical_elements/magnesium/magnesium5d_COG.tif',
  aluminum: 'chemical_elements/aluminum/aluminum5d_COG.tif',
  oxygen: 'chemical_elements/oxygen/oxygen5d_COG.tif',
  potassium: 'chemical_elements/potassium/potassium2d_COG.tif',
};

const basename = path => path.split('/').pop();
const docker = (args, options = {}) => execFileSync('docker', args, options);

// docker cp cannot write into a container with a read-only root filesystem, so
// the bytes go through the container's own shell instead.
function copyIntoTmpfs() {
  docker(['exec', '-u', 'root', CONTAINER, 'mkdir', '-p', TMPFS_DIR]);
  for (const path of Object.values(LAYERS)) {
    const bytes = readFileSync(`${DATA_PATH}/${path}`);
    docker(
      ['exec', '-i', '-u', 'root', CONTAINER, 'sh', '-c', `cat > ${TMPFS_DIR}/${basename(path)}`],
      { input: bytes }
    );
  }
}

const removeFromTmpfs = () =>
  docker(['exec', '-u', 'root', CONTAINER, 'rm', '-rf', TMPFS_DIR]);

const bindPath = path => `/data/${path}`;
const tmpfsPath = path => `${TMPFS_DIR}/${basename(path)}`;

const url = (path, lon) => `${BASE}/${lon},10?url=${path}&bidx=1&coord_crs=IAU:30100`;

async function timed(fn) {
  const start = performance.now();
  await fn();
  return performance.now() - start;
}

function summarise(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return `median=${sorted[Math.floor(sorted.length / 2)].toFixed(0)}ms mean=${mean.toFixed(0)}ms ` +
         `min=${sorted[0].toFixed(0)}ms max=${sorted[sorted.length - 1].toFixed(0)}ms`;
}

const single = (resolve, lon) =>
  fetch(url(resolve(LAYERS.iron), lon)).then(r => r.json());

const batch = (resolve, lon) =>
  Promise.all(Object.values(LAYERS).map(p => fetch(url(resolve(p), lon)).then(r => r.json())));

copyIntoTmpfs();

try {
  const singleBind = [], singleTmpfs = [], batchBind = [], batchTmpfs = [];

  for (let i = 0; i < SINGLE_SAMPLES; i++) {
    singleBind.push(await timed(() => single(bindPath, i)));
    singleTmpfs.push(await timed(() => single(tmpfsPath, i)));
  }
  for (let i = 0; i < BATCH_SAMPLES; i++) {
    batchBind.push(await timed(() => batch(bindPath, i)));
    batchTmpfs.push(await timed(() => batch(tmpfsPath, i)));
  }

  console.log(`Single point request, ${SINGLE_SAMPLES} samples interleaved`);
  console.log(`  bind mount  ${summarise(singleBind)}`);
  console.log(`  tmpfs       ${summarise(singleTmpfs)}`);
  console.log(`\n${Object.keys(LAYERS).length}-layer batch, ${BATCH_SAMPLES} samples interleaved`);
  console.log(`  bind mount  ${summarise(batchBind)}`);
  console.log(`  tmpfs       ${summarise(batchTmpfs)}`);
} finally {
  removeFromTmpfs();
}
