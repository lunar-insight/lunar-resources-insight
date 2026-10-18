import * as Cesium from 'cesium';

// Above the Moon's highest terrain, about 10.8 km over the reference sphere.
export const LUNAR_MAX_TERRAIN_HEIGHT = 11_000;

interface ApproximateTerrainHeightsTable {
  _initPromise?: Promise<void>;
  _terrainHeights?: Record<string, [number, number]>;
  _defaultMaxTerrainHeight: number;
  _defaultMinTerrainHeight: number;
}

/**
 * Ground primitives (CLAMP_TO_GROUND ellipses and polygons, lines clamped to
 * the ground) draw inside a volume bounded by Cesium's
 * ApproximateTerrainHeights, a table of Earth's terrain by tile. The Moon's
 * terrain at the same latitude and longitude often falls outside that range,
 * and the shape is then not drawn. An empty table makes every tile take the
 * default bounds, set here to cover the whole Moon. Must run before the first
 * viewer is created, since the table loads once.
 */
export function applyLunarTerrainBounds(): void {
  const table = (Cesium as unknown as { ApproximateTerrainHeights: ApproximateTerrainHeightsTable })
    .ApproximateTerrainHeights;
  table._terrainHeights = {};
  table._initPromise = Promise.resolve();
  table._defaultMaxTerrainHeight = LUNAR_MAX_TERRAIN_HEIGHT;
}
