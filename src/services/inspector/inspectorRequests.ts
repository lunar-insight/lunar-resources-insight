import * as Cesium from 'cesium';
import {
  fetchCogInfo,
  fetchLayerBounds,
  getBatchedPointValueUrl,
  isProjectedCrs,
  pointIndexAssetKey,
  pointIndexAssetsUrl,
  tilerEndpoints,
  workspacePath,
} from 'geoConfigExporter';
import { stacService } from 'services/StacService';
import { TerrainService } from 'services/TerrainService';
import { mergePartStatistics, type ClippedRange, type FeatureStatistics, type Histogram } from './inspectorStatistics';
import {
  MOON_RADIUS_M,
  localShape,
  ringExtentKm,
  ringNearMeridian,
  shapeParts,
  type LonLat,
} from './featureGeometry';
import { PICTURE_HEIGHT, PICTURE_WIDTH, localCrs, type View, type ViewPart } from './pictureGeometry';
import { decodeRgba, type ValueRange } from './pictureValues';

const RETRY_DELAY_MS = 300;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Runs a request a second time after a short delay, unless it was aborted. */
async function withRetry<T>(request: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (signal?.aborted) throw error;
    await wait(RETRY_DELAY_MS);
    return request();
  }
}

const boundsByFile = new Map<string, Promise<number[]>>();

/** Dataset bounds [west, south, east, north] in degrees, read once per file. */
export function fetchFileBounds(filename: string, stac?: string): Promise<number[]> {
  let request = boundsByFile.get(filename);
  if (!request) {
    request = fetchLayerBounds(filename, stac).catch(error => {
      boundsByFile.delete(filename);
      throw error;
    });
    boundsByFile.set(filename, request);
  }
  return request;
}

/** Native resolution of a file's catalog item, `lri:resolution_km`. */
export async function fetchResolutionKm(stac?: string): Promise<number | undefined> {
  if (!stac) return undefined;
  const item = await stacService.fetchStacItem(stac);
  const value = item?.properties['lri:resolution_km'];
  return typeof value === 'number' ? value : undefined;
}

const isPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number');

const sentence = (value: unknown) => (typeof value === 'string' ? value : undefined);

/**
 * Clipping of a file's catalog item: `lri:clipped_range`, with the optional
 * `lri:clipped_longitudes` and `lri:clipped_notes`. Undefined for a map not
 * clipped.
 */
export async function fetchClippedRange(stac?: string): Promise<ClippedRange | undefined> {
  if (!stac) return undefined;
  const properties = (await stacService.fetchStacItem(stac))?.properties;
  const range = properties?.['lri:clipped_range'];
  if (!isPair(range)) return undefined;

  const longitudes = properties?.['lri:clipped_longitudes'];
  const notes = properties?.['lri:clipped_notes'] as Record<string, unknown> | undefined;
  return {
    range,
    ...(isPair(longitudes) ? { longitudes } : {}),
    ...(notes && typeof notes === 'object' ? { notes: { low: sentence(notes.low), high: sentence(notes.high) } } : {}),
  };
}

let assetKeysRequest: Promise<Set<string> | null> | null = null;

// A request naming a key the index does not hold fails the whole batch.
function loadIndexAssetKeys(): Promise<Set<string> | null> {
  assetKeysRequest ??= fetch(pointIndexAssetsUrl)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response.json();
    })
    .then(data => new Set<string>(data?.assets ?? []))
    .catch((error): null => {
      console.warn('Failed to load the point index asset list:', error);
      assetKeysRequest = null;
      return null;
    });
  return assetKeysRequest;
}

export class PointRequestError extends Error {}

/**
 * Reads several files at one coordinate in one request. A file with no data
 * there maps to null. Every file must cover the coordinate, or the whole
 * request fails.
 */
export async function fetchPointValues(
  filenames: string[],
  position: LonLat,
  signal?: AbortSignal,
): Promise<Map<string, number | null>> {
  const values = new Map<string, number | null>();
  const unique = [...new Set(filenames)];
  if (unique.length === 0) return values;

  const indexKeys = await loadIndexAssetKeys();
  const missing = indexKeys ? unique.filter(f => !indexKeys.has(pointIndexAssetKey(f))) : [];
  if (missing.length > 0) {
    throw new PointRequestError(`The point index does not hold ${missing.join(', ')}`);
  }

  const keys = unique.map(pointIndexAssetKey);
  const url = getBatchedPointValueUrl(keys, position.lon, position.lat, { coord_crs: 'IAU:30100' });

  const data = await withRetry(async () => {
    const response = await fetch(url, { signal });
    if (!response.ok) throw new PointRequestError(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }, signal);

  // The tiler names each band for its asset in `band_descriptions`.
  const bandNames: string[] = data?.band_descriptions ?? data?.band_names ?? [];
  const bandValues: unknown[] = data?.values ?? [];
  const byKey = new Map<string, number | null>();
  bandNames.forEach((name, index) => {
    const value = bandValues[index];
    byKey.set(name, typeof value === 'number' && Number.isFinite(value) ? value : null);
  });

  unique.forEach(filename => values.set(filename, byKey.get(pointIndexAssetKey(filename)) ?? null));
  return values;
}

/** Shape statistics are read capped at this many pixels on the longer side. */
export const SHAPE_MAX_SIZE = 1024;
/** Bins of a shape's histogram, from its lowest to highest value. */
export const HISTOGRAM_BINS = 12;

const isNumbers = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(v => typeof v === 'number' && Number.isFinite(v));

/** The tiler's `[counts, edges]`, or undefined when it is not one. */
function readHistogram(value: unknown): Histogram | undefined {
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  const [counts, edges] = value;
  if (!isNumbers(counts) || !isNumbers(edges) || counts.length === 0 || edges.length !== counts.length + 1) return undefined;
  return { counts, edges };
}

const MOON_CRS = 'IAU_2015:30100';
/**
 * A warped read reaching 180° reads a file's whole width. On a global file of
 * this many pixels across, that takes over a minute for a small shape.
 */
const WIDE_FILE_PIXELS = 10_000;
/** From this size, a warped read uses an overview coarse enough to answer in seconds. */
const PARTS_BELOW_KM = 400;
/** Fine bins per bin shown, when two parts are read over one range. */
const FINE_BINS_PER_BIN = 100;

async function isWideGlobalFile(filename: string): Promise<boolean> {
  const { crs, width } = await fetchFileInfo(filename);
  return !isProjectedCrs(crs) && width >= WIDE_FILE_PIXELS;
}

async function postStatistics(
  filename: string,
  geojson: object,
  query: Record<string, string>,
  signal?: AbortSignal,
) {
  const params = new URLSearchParams({
    url: `${workspacePath}/${filename}`,
    bidx: '1',
    max_size: String(SHAPE_MAX_SIZE),
    ...query,
  });
  params.append('p', '15');
  params.append('p', '85');

  const data = await withRetry(async () => {
    const response = await fetch(`${tilerEndpoints.statistics}?${params}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geojson),
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return response.json();
  }, signal);
  return data?.properties?.statistics?.b1;
}

/**
 * Two reads in a file's own grid, which end exactly at 180°, merged by the ground
 * each holds. The first gives the shape's range, the second each part's histogram
 * over that range, since histograms over different ranges do not add.
 */
async function fetchStatisticsInParts(
  filename: string,
  parts: ReturnType<typeof shapeParts>,
  signal?: AbortSignal,
): Promise<FeatureStatistics | null> {
  const read: { part: (typeof parts)[number]; stats: FeatureStatistics }[] = [];
  for (const part of parts) {
    const b1 = await postStatistics(
      filename, part.geojson, { coord_crs: MOON_CRS, histogram_bins: String(HISTOGRAM_BINS) }, signal,
    );
    const stats = toStatistics(b1);
    if (stats) read.push({ part, stats });
  }
  if (read.length === 0) return null;

  const shapeAreaKm2 = parts.reduce((sum, part) => sum + part.areaKm2, 0);
  if (read.length === 1) {
    const [{ part, stats }] = read;
    return { ...stats, coverage: (stats.coverage * part.areaKm2) / shapeAreaKm2 };
  }

  const lowest = Math.min(...read.map(({ stats }) => stats.min));
  const highest = Math.max(...read.map(({ stats }) => stats.max));
  const merged = [];
  for (const { part, stats } of read) {
    const b1 = await postStatistics(filename, part.geojson, {
      coord_crs: MOON_CRS,
      histogram_bins: String(HISTOGRAM_BINS * FINE_BINS_PER_BIN),
      histogram_range: `${lowest},${highest}`,
    }, signal);
    const fine = readHistogram(b1?.histogram);
    if (!fine) throw new Error(`No histogram for a part of ${filename}`);
    merged.push({ areaKm2: part.areaKm2, stats, fine });
  }
  return mergePartStatistics(merged, shapeAreaKm2, HISTOGRAM_BINS);
}

/**
 * Statistics over the ground inside a shape. Null when it holds no data. Read in
 * a projection local to the shape, where every pixel covers the same ground. A
 * small shape at 180° on a very wide global file is read in two parts instead.
 */
export async function fetchShapeStatistics(
  filename: string,
  ring: LonLat[],
  signal?: AbortSignal,
): Promise<FeatureStatistics | null> {
  if (ringNearMeridian(ring) && ringExtentKm(ring) < PARTS_BELOW_KM && await isWideGlobalFile(filename)) {
    return fetchStatisticsInParts(filename, shapeParts(ring), signal);
  }
  const { crs, geojson } = localShape(ring);
  return toStatistics(await postStatistics(
    filename, geojson, { coord_crs: crs, dst_crs: crs, histogram_bins: String(HISTOGRAM_BINS) }, signal,
  ));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toStatistics(b1: any): FeatureStatistics | null {
  if (!b1 || !b1.count || !Number.isFinite(b1.mean)) return null;

  const histogram = readHistogram(b1.histogram);
  return {
    mean: b1.mean,
    median: b1.median,
    std: b1.std,
    min: b1.min,
    max: b1.max,
    p15: b1.percentile_15,
    p85: b1.percentile_85,
    count: b1.count,
    coverage: b1.valid_percent,
    ...(histogram ? { histogram } : {}),
  };
}

export interface Elevation {
  /** The value at a point, the mean over a shape or along a line, in meters. */
  value: number;
  lowest: number;
  highest: number;
}

/**
 * Elevation from the terrain tiles, or null when no terrain is loaded. The value
 * is the mean of `positions`. An `outline` adds to the lowest and highest only,
 * as its vertices crowd the rim of a shape, unless no position has a height.
 */
export async function sampleElevation(positions: LonLat[], outline: LonLat[] = []): Promise<Elevation | null> {
  const provider = TerrainService.getTerrainProvider();
  const all = [...positions, ...outline];
  if (!(provider instanceof Cesium.CesiumTerrainProvider) || all.length === 0) return null;

  const sampled = await TerrainService.sampleTerrainHeights(
    all.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat)),
  );
  const isHeight = (h: number) => Number.isFinite(h);
  const heights = sampled.map(c => c.height).filter(isHeight);
  if (heights.length === 0) return null;

  const spread = sampled.slice(0, positions.length).map(c => c.height).filter(isHeight);
  const averaged = spread.length > 0 ? spread : heights;
  return {
    value: averaged.reduce((sum, h) => sum + h, 0) / averaged.length,
    lowest: Math.min(...heights),
    highest: Math.max(...heights),
  };
}

const KM_PER_DEGREE = (Math.PI * MOON_RADIUS_M) / 180 / 1000;

const infoByFile = new Map<string, ReturnType<typeof fetchCogInfo>>();

/** A file's bounds, CRS and width, read once per file. */
function fetchFileInfo(filename: string): ReturnType<typeof fetchCogInfo> {
  let request = infoByFile.get(filename);
  if (!request) {
    request = fetchCogInfo(filename).catch(error => {
      infoByFile.delete(filename);
      throw error;
    });
    infoByFile.set(filename, request);
  }
  return request;
}

/** Width of a file's pixel in km. A projected file gives its bounds in meters. */
export async function fetchFilePixelKm(filename: string): Promise<number> {
  const { bounds, crs, width } = await fetchFileInfo(filename);
  const pixel = (bounds[2] - bounds[0]) / width;
  return isProjectedCrs(crs) ? pixel / 1000 : pixel * KM_PER_DEGREE;
}

/** Gray and alpha of a picture, row by row from the top. */
export interface PicturePixels {
  gray: Uint8Array;
  alpha: Uint8Array;
}

async function decodePng(blob: Blob, width: number, height: number): Promise<PicturePixels> {
  const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0);
  bitmap.close();
  return decodeRgba(context.getImageData(0, 0, width, height).data, width, height);
}

function pictureUrl(filename: string, view: View, part: ViewPart, range: ValueRange | null): string {
  const crs = localCrs(view.center);
  const params = new URLSearchParams({ url: `${workspacePath}/${filename}`, bidx: '1', coord_crs: crs, dst_crs: crs });
  if (range) params.set('rescale', `${range[0]},${range[1]}`);
  return `${tilerEndpoints.bbox}/${part.x0},${part.y0},${part.x1},${part.y1}/${part.width}x${part.height}.png?${params}`;
}

/**
 * A picture of a file over a view, one request per part, composed side by side.
 * A null range sends no rescale, for a byte file. The nearest neighbor default of
 * the tiler keeps pixels real values.
 */
export async function fetchPicture(
  filename: string,
  view: View,
  range: ValueRange | null,
  signal?: AbortSignal,
): Promise<PicturePixels> {
  const pieces = await Promise.all(view.parts.map(part => withRetry(async () => {
    const response = await fetch(pictureUrl(filename, view, part, range), { signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    return decodePng(await response.blob(), part.width, part.height);
  }, signal)));

  const gray = new Uint8Array(PICTURE_WIDTH * PICTURE_HEIGHT);
  const alpha = new Uint8Array(PICTURE_WIDTH * PICTURE_HEIGHT);
  let column = 0;
  view.parts.forEach(({ width }, index) => {
    for (let row = 0; row < PICTURE_HEIGHT; row++) {
      const from = row * width;
      const at = row * PICTURE_WIDTH + column;
      gray.set(pieces[index].gray.subarray(from, from + width), at);
      alpha.set(pieces[index].alpha.subarray(from, from + width), at);
    }
    column += width;
  });
  return { gray, alpha };
}

/** Test hook: forgets the stored bounds, file pixels and asset list. */
export function resetInspectorRequestCaches(): void {
  boundsByFile.clear();
  infoByFile.clear();
  assetKeysRequest = null;
}
