// Checks every raster in the layer config for a whole Moon p15 to p85 width
// that cannot serve as the spread reference: zero, or under 2% of the layer's
// min to max range.
//
// Requires the dev stack running.
//
//   node docs/measurements/feature-statistics/layer-widths.mjs

import { readFileSync } from 'node:fs';
import { BASE } from './lib.mjs';

const config = readFileSync(new URL('../../../src/layersConfig.ts', import.meta.url), 'utf8');
const files = [...new Set([...config.matchAll(/filename: "([^"]+\.tif)"/g)].map(match => match[1]))];

let flagged = 0;
for (const file of files) {
  const params = new URLSearchParams({ url: `/data/${file}`, bidx: '1' });
  for (const value of [2, 15, 85, 95, 98]) params.append('p', String(value));
  const response = await fetch(`${BASE}/cog/statistics?${params}`);
  if (!response.ok) {
    console.log(`  HTTP ${response.status}  ${file}`);
    continue;
  }
  const b = (await response.json()).b1;
  const width = b.percentile_85 - b.percentile_15;
  if (!(width > 0) || width / (b.max - b.min) < 0.02) {
    flagged++;
    console.log(`  width ${width.toFixed(3)}  p15 ${b.percentile_15}  min ${b.min}  max ${b.max.toFixed(2)}  ${file}`);
  }
}
console.log(`${files.length} files, ${flagged} flagged`);
