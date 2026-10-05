// Shared requests, shapes and layers for the feature statistics measurements.

export const BASE = process.env.TILER_BASE ?? 'http://localhost:5173';

// Without it the tiler reads the shape as EPSG:4326 and fails with a 500.
export const MOON_CRS = 'IAU_2015:30100';

// Boxes as [west, south, east, north] in degrees, planetocentric longitude
// from -180 to 180.
export const SHAPES = {
  tranquillitatis: [25, 3, 35, 13],
  imbrium: [-24, 28, -12, 40],
  farsideHighlands: [155, 5, 170, 20],
  spaInterior: [-175, -55, -160, -45],
  crisium: [47, 5, 71, 29],
  apennineFront: [-10, 15, 5, 30],
  fraMauro: [-25, -5, -10, 10],
};

// Grid is the file's pixel size. Native is the bin for binned products and
// the grid for imaging products; for the gamma ray layers the instrument
// resolution is coarser than the bin (lri:resolution_km in the catalog).
export const LAYERS = {
  thoriumPrettyman2d: {
    file: 'chemical_elements/thorium/thorium_2d_prettyman2006_COG.tif',
    unit: 'ppm', gridDeg: 1, nativeDeg: 2,
  },
  thoriumLpHalfDeg: {
    file: 'chemical_elements/thorium/thoriumhd_COG.tif',
    unit: 'ppm', gridDeg: 0.5, nativeDeg: 0.5,
  },
  hydrogenLawrence: {
    file: 'chemical_elements/hydrogen/hydrogen_abundance_lawrence_COG.tif',
    unit: 'ppm', gridDeg: 0.5, nativeDeg: 0.5,
  },
  feoPrettyman2d: {
    file: 'compounds/feo/feo_2d_prettyman2006_COG.tif',
    unit: 'wt%', gridDeg: 1, nativeDeg: 2,
  },
  feoClementine: {
    file: 'compounds/feo/feo_clementine_cnn_qiu2025_COG.tif',
    unit: 'wt%', gridDeg: 0.0033, nativeDeg: 0.0033,
  },
  mgNumberClementine: {
    file: 'derived/mg_number/mg_number_clementine_cnn_qiu2025_COG.tif',
    unit: 'Mg#', gridDeg: 0.0033, nativeDeg: 0.0033,
  },
  plagioclaseKaguyaMi: {
    file: 'minerals/Plagioclase/plagioclase_kaguya_mi_lemelin2016_COG.tif',
    unit: 'wt%', gridDeg: 0.002, nativeDeg: 0.002,
  },
  ironCh2Class: {
    file: 'chemical_elements/iron/iron_ch2_class_COG.tif',
    unit: 'wt%', gridDeg: 0.36, nativeDeg: 0.36,
  },
};

export const boxFeature = ([w, s, e, n]) => ({
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]] },
});

// Statistics over one shape. maxSize caps the longer side of the read; null
// reads at full resolution.
export async function shapeStats(file, box, { p = [15, 85], maxSize = 1024, crs = MOON_CRS } = {}) {
  const params = new URLSearchParams({ url: `/data/${file}`, bidx: '1' });
  for (const value of p) params.append('p', String(value));
  if (crs) params.set('coord_crs', crs);
  if (maxSize) params.set('max_size', String(maxSize));

  const start = performance.now();
  const response = await fetch(`${BASE}/cog/statistics?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(boxFeature(box)),
  });
  const body = await response.json();
  const ms = performance.now() - start;
  if (!response.ok) return { ms, status: response.status, body };
  return { ms, status: response.status, b1: body.properties.statistics.b1 };
}

// Whole layer statistics, the request LayerStatsService sends. The tiler
// caps that read at max_size 1024 unless told otherwise.
export async function layerStats(file, { maxSize } = {}) {
  const params = new URLSearchParams({ url: `/data/${file}`, bidx: '1' });
  for (const value of [2, 15, 85, 95, 98]) params.append('p', String(value));
  if (maxSize) params.set('max_size', String(maxSize));
  const response = await fetch(`${BASE}/cog/statistics?${params}`);
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  return (await response.json()).b1;
}

export const median = values => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

export const fmt = (value, digits = 2) =>
  value === undefined || value === null || Number.isNaN(value) ? '-' : value.toFixed(digits);
