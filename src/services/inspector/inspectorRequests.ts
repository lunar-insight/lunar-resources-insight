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
import type { ClippedRange, FeatureStatistics, Histogram } from './inspectorStatistics';
import { MOON_RADIUS_M, type LonLat } from './featureGeometry';
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

/**
 * Statistics over the pixels inside a shape, given as a GeoJSON Feature in
 * degrees. Null when the shape holds no data.
 */
export async function fetchShapeStatistics(
  filename: string,
  geojson: object,
  signal?: AbortSignal,
): Promise<FeatureStatistics | null> {
  const params = new URLSearchParams({
    url: `${workspacePath}/${filename}`,
    bidx: '1',
    coord_crs: 'IAU_2015:30100',
    max_size: String(SHAPE_MAX_SIZE),
    histogram_bins: String(HISTOGRAM_BINS),
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

  const b1 = data?.properties?.statistics?.b1;
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

/** Elevation from the terrain tiles, or null when no terrain is loaded. */
export async function sampleElevation(positions: LonLat[]): Promise<Elevation | null> {
  const provider = TerrainService.getTerrainProvider();
  if (!(provider instanceof Cesium.CesiumTerrainProvider) || positions.length === 0) return null;

  const sampled = await TerrainService.sampleTerrainHeights(
    positions.map(p => Cesium.Cartographic.fromDegrees(p.lon, p.lat)),
  );
  const heights = sampled.map(c => c.height).filter(h => Number.isFinite(h));
  if (heights.length === 0) return null;

  return {
    value: heights.reduce((sum, h) => sum + h, 0) / heights.length,
    lowest: Math.min(...heights),
    highest: Math.max(...heights),
  };
}

const KM_PER_DEGREE = (Math.PI * MOON_RADIUS_M) / 180 / 1000;

const pixelKmByFile = new Map<string, Promise<number>>();

/** Width of a file's pixel in km, read once per file. A projected file gives its bounds in meters. */
export function fetchFilePixelKm(filename: string): Promise<number> {
  let request = pixelKmByFile.get(filename);
  if (!request) {
    request = fetchCogInfo(filename)
      .then(({ bounds, crs, width }) => {
        const pixel = (bounds[2] - bounds[0]) / width;
        return isProjectedCrs(crs) ? pixel / 1000 : pixel * KM_PER_DEGREE;
      })
      .catch(error => {
        pixelKmByFile.delete(filename);
        throw error;
      });
    pixelKmByFile.set(filename, request);
  }
  return request;
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
  pixelKmByFile.clear();
  assetKeysRequest = null;
}
