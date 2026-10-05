import * as Cesium from 'cesium';
import {
  fetchLayerBounds,
  getBatchedPointValueUrl,
  pointIndexAssetKey,
  pointIndexAssetsUrl,
  tilerEndpoints,
  workspacePath,
} from 'geoConfigExporter';
import { stacService } from 'services/StacService';
import { TerrainService } from 'services/TerrainService';
import type { FeatureStatistics } from './inspectorStatistics';
import type { LonLat } from './featureGeometry';

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

/** Test hook: forgets the stored bounds and asset list. */
export function resetInspectorRequestCaches(): void {
  boundsByFile.clear();
  assetKeysRequest = null;
}
