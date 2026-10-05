// Compares each layer's lri:resolution_km with the pixel size of the file the
// tiler serves, and flags any resolution finer than its pixel.
//
// Requires the dev stack running. The pixel size is read inside the tiler
// container, which has rasterio and the /data mount.
//
//   node docs/measurements/feature-statistics/resolution-vs-pixel.mjs

import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const CONTAINER = process.env.TILER_CONTAINER ?? 'planetcantile-planetcantile-1';
const root = new URL('../../../', import.meta.url);

const config = readFileSync(new URL('src/layersConfig.ts', root), 'utf8');
const pairs = new Map();
for (const match of config.matchAll(/filename: "([^"]+\.tif)",[^}]*?stac: "([^"]+)"/g)) {
  pairs.set(match[1], match[2]);
}
const rows = [...pairs].map(([file, stac]) => {
  const item = JSON.parse(readFileSync(new URL(`public/stac/${stac}`, root), 'utf8'));
  return [file, item.properties['lri:resolution_km'] ?? null];
});

// Moon radius 1737.4 km turns a geographic pixel height in degrees into km.
const PY = `
import json, math, sys, rasterio
for f, res in json.load(sys.stdin):
    with rasterio.open('/data/' + f) as src:
        px = src.res[1] * math.pi * 1737.4 / 180 if src.crs.is_geographic else src.res[1] / 1000
    ratio = res / px if res else 0
    flag = '  below pixel size' if res is not None and res < px * 0.99 else ''
    print(f"{ratio:5.1f}  pixel {px:8.3f} km  resolution {res}  {f.split('/')[-1]}{flag}")
`;

const result = spawnSync('docker', ['exec', '-i', CONTAINER, 'python', '-c', PY], {
  input: JSON.stringify(rows),
  encoding: 'utf8',
});
if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(1);
}
console.log('ratio  resolution over pixel size');
console.log(result.stdout.trim().split('\n').sort((a, b) => parseFloat(a) - parseFloat(b)).join('\n'));
