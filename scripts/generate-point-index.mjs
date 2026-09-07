// Writes the point index the tiler reads when answering a batched point query.
//
//   <data>/index/point-index.json  one STAC item, one asset per single-band raster
//   <data>/index/assets.json       the asset keys that item holds
//
//   DATA_PATH=<host raster directory> node scripts/generate-point-index.mjs
//   npm run point-index            (reads DATA_PATH from .env)
//
// The data directory is the only input, so an href always names a file that
// exists. layersConfig.ts is a cross-check, reported at the end.

import { open, mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Path the tiler mounts the data directory at, mirrored by VITE_WORKSPACE_PATH.
const MOUNT_PREFIX = '/data';

// The client names the item and the asset list as constants.
const INDEX_DIR = 'index';
const ITEM_FILE = 'point-index.json';
const ASSETS_FILE = 'assets.json';
const ITEM_ID = 'lri-point-index';

const RASTER_EXTENSIONS = new Set(['.tif', '.tiff']);
const GEOTIFF_MEDIA_TYPE = 'image/tiff; application=geotiff';

const POINT_INSTANCE = 'planetcantile-point';

function parseArgs(argv) {
  const dataArg = argv.indexOf('--data');
  const dataPath = dataArg === -1 ? process.env.DATA_PATH : argv[dataArg + 1];
  if (!dataPath) {
    console.error('DATA_PATH must point at the host raster directory, or pass --data <path>.');
    process.exit(1);
  }
  return { dataPath: path.resolve(dataPath) };
}

// Same rule as pointIndexAssetKey in src/geoConfigExporter.ts.
function assetKey(filename) {
  return path.basename(filename).replace(/\.[^.]*$/, '').replace(/_cog$/i, '');
}

async function walkRasters(root, dir = root, found = []) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (path.relative(root, full) === INDEX_DIR) continue;
      await walkRasters(root, full, found);
    } else if (entry.isFile() && RASTER_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      found.push(full);
    }
  }
  return found;
}

// Reads the header and the first image file directory. A file truncated at or
// before that point is excluded here, since one unreadable asset fails a whole
// batched request. Pixel data is not read.
async function readTiffHeader(file) {
  const handle = await open(file, 'r');
  try {
    const header = Buffer.alloc(16);
    const { bytesRead } = await handle.read(header, 0, 16, 0);
    if (bytesRead < 8) throw new Error('shorter than a TIFF header');

    const order = header.toString('latin1', 0, 2);
    if (order !== 'II' && order !== 'MM') throw new Error('byte order is neither II nor MM');
    const le = order === 'II';
    const u16 = (buf, off) => (le ? buf.readUInt16LE(off) : buf.readUInt16BE(off));
    const u32 = (buf, off) => (le ? buf.readUInt32LE(off) : buf.readUInt32BE(off));
    const u64 = (buf, off) => Number(le ? buf.readBigUInt64LE(off) : buf.readBigUInt64BE(off));

    const version = u16(header, 2);
    let ifdOffset;
    let countSize;
    let entrySize;
    // Offset of a field's inline value within its directory entry.
    let valueOffset;
    if (version === 42) {
      ifdOffset = u32(header, 4);
      countSize = 2;
      entrySize = 12;
      valueOffset = 8;
    } else if (version === 43) {
      if (u16(header, 4) !== 8) throw new Error('unsupported BigTIFF offset size');
      ifdOffset = u64(header, 8);
      countSize = 8;
      entrySize = 20;
      valueOffset = 12;
    } else {
      throw new Error(`TIFF version ${version} is neither 42 nor 43`);
    }
    if (ifdOffset === 0) throw new Error('no image file directory');

    const countBuf = Buffer.alloc(countSize);
    if ((await handle.read(countBuf, 0, countSize, ifdOffset)).bytesRead < countSize) {
      throw new Error('truncated before the image file directory');
    }
    const entryCount = countSize === 2 ? u16(countBuf, 0) : u64(countBuf, 0);
    if (entryCount === 0) throw new Error('empty image file directory');

    const entries = Buffer.alloc(entryCount * entrySize);
    const read = await handle.read(entries, 0, entries.length, ifdOffset + countSize);
    if (read.bytesRead < entries.length) throw new Error('truncated inside the image file directory');

    // ImageWidth, ImageLength and SamplesPerPixel, each a single value that
    // sits inline.
    const TAGS = { 256: 'width', 257: 'height', 277: 'bands' };
    const size = { bands: 1 };
    for (let i = 0; i < entryCount; i++) {
      const at = i * entrySize;
      const name = TAGS[u16(entries, at)];
      if (!name) continue;
      const type = u16(entries, at + 2);
      if (type === 3) size[name] = u16(entries, at + valueOffset);
      else if (type === 4) size[name] = u32(entries, at + valueOffset);
      else if (type === 16 && entrySize === 20) size[name] = u64(entries, at + valueOffset);
      else throw new Error(`${name} has field type ${type}`);
    }

    if (!size.width || !size.height) throw new Error('no image dimensions');
    return size;
  } finally {
    await handle.close();
  }
}

// A reader never sees a partly written file, and a restart never loads one.
async function writeAtomic(file, contents) {
  const temp = `${file}.tmp`;
  await writeFile(temp, contents);
  await rename(temp, file);
}

function buildItem(assets) {
  return {
    type: 'Feature',
    stac_version: '1.0.0',
    id: ITEM_ID,
    // geometry, bbox and datetime are present because STAC requires them. The
    // point path reads the named assets directly, and each asset's own bounds
    // decide the result.
    geometry: {
      type: 'Polygon',
      coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
    },
    bbox: [-180, -90, 180, 90],
    properties: { datetime: '2026-01-01T00:00:00Z' },
    links: [],
    assets: Object.fromEntries(
      [...assets.entries()].map(([key, href]) => [key, { href, type: GEOTIFF_MEDIA_TYPE }])
    ),
  };
}

// The tiler holds a parsed item for the life of the worker process, keyed on
// the item path with no expiry. Rewriting the file under the same name serves
// the previous asset list until the process ends.
function restartPointInstance() {
  let names;
  try {
    names = execFileSync(
      'docker',
      ['ps', '--filter', `name=${POINT_INSTANCE}`, '--format', '{{.Names}}'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    ).split('\n').map(name => name.trim()).filter(Boolean);
  } catch {
    return `docker unavailable, restart ${POINT_INSTANCE} to clear the parsed item`;
  }

  if (names.length === 0) return 'not running, a fresh start reads the new index';

  execFileSync('docker', ['restart', ...names], { stdio: ['ignore', 'pipe', 'pipe'] });
  return `restarted ${names.join(', ')}`;
}

// One entry per file the config names, including variant filenames.
function configEntries(layersConfig) {
  const entries = [];
  for (const [layerId, config] of Object.entries(layersConfig.layers)) {
    // An unavailable layer names a file that is not on disk. A vector layer's
    // filename is an app-origin path, outside the tiler mount.
    const expectedAbsent = config.available === false || config.layerType === 'vector';
    entries.push({ layerId, filename: config.filename, stac: config.stac, expectedAbsent });
    for (const variant of config.variants ?? []) {
      entries.push({
        layerId: `${layerId} [${variant.label}]`,
        filename: variant.filename,
        stac: variant.stac,
        expectedAbsent,
      });
    }
  }
  return entries;
}

// Runs against every raster on disk. The index is a subset of those.
async function crossCheck(entries, diskPaths) {
  const referenced = new Set(entries.map(entry => entry.filename));
  const onDisk = new Set(diskPaths);

  const unreferenced = diskPaths.filter(rel => !referenced.has(rel));
  const absent = entries.filter(entry => !onDisk.has(entry.filename));

  // A layer's catalog item and its filename share a basename.
  const stacIssues = [];
  for (const entry of entries) {
    if (!entry.stac || entry.expectedAbsent) continue;
    let item;
    try {
      item = JSON.parse(await readFile(path.join(repoRoot, 'public', 'stac', entry.stac), 'utf8'));
    } catch {
      stacIssues.push(`${entry.layerId}: no catalog item at public/stac/${entry.stac}`);
      continue;
    }
    const href = item.assets?.data?.href;
    if (!href) {
      stacIssues.push(`${entry.layerId}: catalog item has no data asset`);
    } else if (path.basename(href) !== path.basename(entry.filename)) {
      stacIssues.push(
        `${entry.layerId}: catalog item names ${path.basename(href)}, config names ${path.basename(entry.filename)}`
      );
    }
  }

  return { unreferenced, absent, stacIssues };
}

function report(title, lines) {
  console.log(`\n${title}`);
  if (lines.length === 0) console.log('  none');
  else for (const line of lines) console.log(`  ${line}`);
}

const { dataPath } = parseArgs(process.argv);

const files = await walkRasters(dataPath);
if (files.length === 0) {
  console.error(`No rasters under ${dataPath}.`);
  process.exit(1);
}

const assets = new Map();
const owners = new Map();
const unreadable = [];
const multiBand = [];
const diskPaths = [];

for (const file of files.sort()) {
  const relative = path.relative(dataPath, file).split(path.sep).join('/');
  diskPaths.push(relative);

  let header;
  try {
    header = await readTiffHeader(file);
  } catch (error) {
    unreadable.push(`${relative}: ${error.message}`);
    continue;
  }

  // A point query reads assets with asset_as_band, which rejects a multi-band
  // asset and fails the whole request naming it.
  if (header.bands > 1) {
    multiBand.push(`${relative}: ${header.bands} bands`);
    continue;
  }

  const key = assetKey(relative);
  if (assets.has(key)) {
    console.error(`Duplicate asset key ${key}: ${owners.get(key)} and ${relative}.`);
    process.exit(1);
  }
  assets.set(key, `${MOUNT_PREFIX}/${relative}`);
  owners.set(key, relative);
}

const indexDir = path.join(dataPath, INDEX_DIR);
await mkdir(indexDir, { recursive: true });

const itemPath = path.join(indexDir, ITEM_FILE);
const assetsPath = path.join(indexDir, ASSETS_FILE);
await writeAtomic(itemPath, JSON.stringify(buildItem(assets), null, 1));
await writeAtomic(assetsPath, JSON.stringify({ assets: [...assets.keys()] }));

console.log(`Data directory  ${dataPath}`);
console.log(`Rasters indexed ${assets.size}`);
console.log(`Item            ${itemPath}`);
console.log(`Asset list      ${assetsPath}`);
console.log(`Point instance  ${restartPointInstance()}`);

report('Rasters that did not open, excluded from the index', unreadable);
report('Multi-band rasters, excluded from the index', multiBand);

const { layersConfig } = await import(pathToFileURL(path.join(repoRoot, 'src', 'layersConfig.ts')).href);
const { unreferenced, absent, stacIssues } = await crossCheck(configEntries(layersConfig), diskPaths);

report('Rasters on disk no layer references', unreferenced);
report(
  'Layer filenames with no file on disk',
  absent.map(entry => `${entry.layerId}: ${entry.filename}${entry.expectedAbsent ? ' (expected)' : ''}`)
);
report('Catalogue items disagreeing with the layer filename', stacIssues);
