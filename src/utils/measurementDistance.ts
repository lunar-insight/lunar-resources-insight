import * as Cesium from 'cesium';
import { TerrainService } from 'services/TerrainService';

// Number of segments used to approximate a terrain-following path between
// two points. Higher counts track terrain more closely at the cost of more
// sampleTerrain requests.
const TERRAIN_SAMPLE_SEGMENTS = 32;

// Curved surface distance between two points along the ellipsoid, ignoring
// elevation.
export const computeSurfaceDistance = (a: Cesium.Cartographic, b: Cesium.Cartographic): number => {
  return new Cesium.EllipsoidGeodesic(a, b).surfaceDistance;
};

// Path length along the geodesic between two points, following sampled
// terrain elevation. A sample with no terrain height available (e.g.
// terrain provider not loaded) is treated as sitting on the ellipsoid
// (height 0).
export const computeTerrainDistance = async (
  a: Cesium.Cartographic,
  b: Cesium.Cartographic
): Promise<number> => {
  const geodesic = new Cesium.EllipsoidGeodesic(a, b);
  if (geodesic.surfaceDistance === 0) return 0;

  const samples: Cesium.Cartographic[] = [];
  for (let i = 0; i <= TERRAIN_SAMPLE_SEGMENTS; i++) {
    const fraction = (geodesic.surfaceDistance * i) / TERRAIN_SAMPLE_SEGMENTS;
    samples.push(geodesic.interpolateUsingSurfaceDistance(fraction));
  }

  const sampled = await TerrainService.sampleTerrainHeights(samples);

  let total = 0;
  for (let i = 1; i < sampled.length; i++) {
    const prev = sampled[i - 1];
    const curr = sampled[i];
    const prevCartesian = Cesium.Cartesian3.fromRadians(prev.longitude, prev.latitude, prev.height ?? 0);
    const currCartesian = Cesium.Cartesian3.fromRadians(curr.longitude, curr.latitude, curr.height ?? 0);
    total += Cesium.Cartesian3.distance(prevCartesian, currCartesian);
  }
  return total;
};
