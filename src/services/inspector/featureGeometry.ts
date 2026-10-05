import * as Cesium from 'cesium';
import type { Feature } from 'components/navigation/FeaturesSection/types';

// Cesium's Moon ellipsoid is a sphere, so spherical formulas are exact on it.
const MOON = Cesium.Ellipsoid.MOON;
export const MOON_RADIUS_M = MOON.maximumRadius;

export type FeatureKind = 'point' | 'line' | 'shape';

/** Degrees. */
export interface LonLat {
  lon: number;
  lat: number;
}

export interface LineSample extends LonLat {
  distanceKm: number;
}

/** Samples spread evenly by distance along a whole line, before its vertices are added. */
export const LINE_SAMPLE_COUNT = 128;

/** Vertices of the polygon a circle is converted to. */
export const CIRCLE_VERTICES = 72;

export function featureKind(type: Feature['type']): FeatureKind {
  if (type === 'point') return 'point';
  if (type === 'line') return 'line';
  return 'shape';
}

/** Shape type as a word: point, line, polygon or circle. */
export function shapeWord(type: Feature['type']): string {
  return type.endsWith('circle') ? 'circle' : type;
}

const toLonLat = (c: Cesium.Cartographic): LonLat => ({
  lon: Cesium.Math.toDegrees(c.longitude),
  lat: Cesium.Math.toDegrees(c.latitude),
});

function circleCenter(feature: Feature): Cesium.Cartographic | undefined {
  const { center, centerPosition } = feature.metadata;
  // Moving a center-radius circle updates `center` only.
  return feature.type === 'circle' ? center ?? centerPosition : centerPosition ?? center;
}

/** Point reached from `from` along a great circle, bearing clockwise from north. */
export function destination(from: LonLat, bearingDeg: number, distanceM: number): LonLat {
  const delta = distanceM / MOON_RADIUS_M;
  const theta = Cesium.Math.toRadians(bearingDeg);
  const phi1 = Cesium.Math.toRadians(from.lat);
  const lambda1 = Cesium.Math.toRadians(from.lon);

  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
    Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2),
  );

  return {
    lon: Cesium.Math.toDegrees(Cesium.Math.negativePiToPi(lambda2)),
    lat: Cesium.Math.toDegrees(phi2),
  };
}

export function circleRing(center: LonLat, radiusM: number, vertices = CIRCLE_VERTICES): LonLat[] {
  return Array.from({ length: vertices }, (_, i) => destination(center, (360 * i) / vertices, radiusM));
}

/** Vertices of a shape feature, unclosed. A circle becomes a polygon. */
export function shapeRing(feature: Feature): LonLat[] | null {
  if (feature.type === 'polygon') {
    const positions = feature.metadata.positions ?? [];
    return positions.length >= 3 ? positions.map(toLonLat) : null;
  }
  const center = circleCenter(feature);
  const radius = feature.metadata.radius;
  if (!center || !radius) return null;
  return circleRing(toLonLat(center), radius);
}

/** GeoJSON Feature for a shape, in degrees, closed. */
export function ringToGeoJson(ring: LonLat[]) {
  const coordinates = ring.map(p => [p.lon, p.lat]);
  coordinates.push([ring[0].lon, ring[0].lat]);
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coordinates] },
  };
}

/** Area of a ring on the Moon's sphere, in km². */
export function ringAreaKm2(ring: LonLat[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    sum += Cesium.Math.toRadians(b.lon - a.lon)
      * (2 + Math.sin(Cesium.Math.toRadians(a.lat)) + Math.sin(Cesium.Math.toRadians(b.lat)));
  }
  const radiusKm = MOON_RADIUS_M / 1000;
  return Math.abs((sum * radiusKm * radiusKm) / 2);
}

/** Area of a shape feature in km². A circle is the exact spherical cap. */
export function featureAreaKm2(feature: Feature): number | null {
  if (feature.type !== 'polygon') {
    const radius = feature.metadata.radius;
    if (!radius) return null;
    const radiusKm = MOON_RADIUS_M / 1000;
    return 2 * Math.PI * radiusKm * radiusKm * (1 - Math.cos(radius / MOON_RADIUS_M));
  }
  const ring = shapeRing(feature);
  return ring ? ringAreaKm2(ring) : null;
}

/** Mean direction of the points, which stays correct across the 180° meridian. */
function meanPosition(points: LonLat[]): LonLat {
  let x = 0, y = 0, z = 0;
  points.forEach(p => {
    const phi = Cesium.Math.toRadians(p.lat);
    const lambda = Cesium.Math.toRadians(p.lon);
    x += Math.cos(phi) * Math.cos(lambda);
    y += Math.cos(phi) * Math.sin(lambda);
    z += Math.sin(phi);
  });
  return {
    lon: Cesium.Math.toDegrees(Math.atan2(y, x)),
    lat: Cesium.Math.toDegrees(Math.atan2(z, Math.hypot(x, y))),
  };
}

/** Point position, circle center, or the mean of a polygon's or line's vertices. */
export function featureCenter(feature: Feature): LonLat | null {
  if (feature.type === 'point') {
    return feature.metadata.position ? toLonLat(feature.metadata.position) : null;
  }
  if (feature.type === 'line' || feature.type === 'polygon') {
    const positions = feature.metadata.positions ?? [];
    return positions.length ? meanPosition(positions.map(toLonLat)) : null;
  }
  const center = circleCenter(feature);
  return center ? toLonLat(center) : null;
}

/** Surface length of a line along its geodesics, in meters. */
export function lineLengthM(positions: Cesium.Cartographic[]): number {
  let total = 0;
  for (let i = 1; i < positions.length; i++) {
    total += new Cesium.EllipsoidGeodesic(positions[i - 1], positions[i], MOON).surfaceDistance;
  }
  return total;
}

/**
 * Samples along a line: `count` spaced evenly by distance over the whole line,
 * plus each vertex, interpolated along the geodesic of their segment.
 */
export function sampleLine(positions: Cesium.Cartographic[], count = LINE_SAMPLE_COUNT): LineSample[] {
  if (positions.length === 0) return [];
  if (positions.length === 1) return [{ ...toLonLat(positions[0]), distanceKm: 0 }];

  const segments: { geodesic: Cesium.EllipsoidGeodesic; start: number; length: number }[] = [];
  let start = 0;
  for (let i = 1; i < positions.length; i++) {
    const geodesic = new Cesium.EllipsoidGeodesic(positions[i - 1], positions[i], MOON);
    segments.push({ geodesic, start, length: geodesic.surfaceDistance });
    start += geodesic.surfaceDistance;
  }
  const total = start;

  const distances = new Set<number>();
  for (let i = 0; i < count; i++) distances.add(count === 1 ? 0 : (total * i) / (count - 1));
  segments.forEach(segment => distances.add(segment.start));
  distances.add(total);

  return [...distances].sort((a, b) => a - b).map(distance => {
    const segment = segments.find(s => distance <= s.start + s.length) ?? segments[segments.length - 1];
    const along = Math.min(Math.max(distance - segment.start, 0), segment.length);
    const point = segment.length === 0
      ? segment.geodesic.start
      : segment.geodesic.interpolateUsingSurfaceDistance(along);
    return { ...toLonLat(point), distanceKm: distance / 1000 };
  });
}

/** Ray casting in longitude and latitude. */
export function isInsideRing(point: LonLat, ring: LonLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if ((a.lat > point.lat) !== (b.lat > point.lat)
      && point.lon < ((b.lon - a.lon) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lon) {
      inside = !inside;
    }
  }
  return inside;
}

/** About `target` points on a regular grid inside a ring, plus its vertices. */
export function gridInsideRing(ring: LonLat[], target = 144): LonLat[] {
  const lons = ring.map(p => p.lon);
  const lats = ring.map(p => p.lat);
  const west = Math.min(...lons), east = Math.max(...lons);
  const south = Math.min(...lats), north = Math.max(...lats);
  const steps = Math.max(2, Math.round(Math.sqrt(target)));

  const points: LonLat[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const p = {
        lon: west + ((east - west) * (i + 0.5)) / steps,
        lat: south + ((north - south) * (j + 0.5)) / steps,
      };
      if (isInsideRing(p, ring)) points.push(p);
    }
  }
  return [...points, ...ring];
}

/** Bounding box [west, south, east, north] in degrees. */
export function ringBounds(ring: LonLat[]): number[] {
  const lons = ring.map(p => p.lon);
  const lats = ring.map(p => p.lat);
  return [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)];
}

export function boundsIntersect(a: number[], b: number[]): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

export function isInsideBounds(point: LonLat, bounds: number[]): boolean {
  return point.lon >= bounds[0] && point.lon <= bounds[2] && point.lat >= bounds[1] && point.lat <= bounds[3];
}

/** Changes whenever an edit moves the feature, and only then. */
export function geometryKey(feature: Feature): string {
  const { metadata } = feature;
  const coords = (c?: Cesium.Cartographic) => (c ? `${c.longitude.toFixed(9)},${c.latitude.toFixed(9)}` : '');
  switch (feature.type) {
    case 'point':
      return `point:${coords(metadata.position)}`;
    case 'line':
    case 'polygon':
      return `${feature.type}:${(metadata.positions ?? []).map(coords).join(';')}`;
    default:
      return `circle:${coords(circleCenter(feature))}:${metadata.radius ?? ''}`;
  }
}

export function formatLatitude(lat: number, decimals: number): string {
  return `${Math.abs(lat).toFixed(decimals)}°${lat >= 0 ? 'N' : 'S'}`;
}

export function formatLongitude(lon: number, decimals: number): string {
  return `${Math.abs(lon).toFixed(decimals)}°${lon >= 0 ? 'E' : 'W'}`;
}

export const formatLonLat = (p: LonLat, decimals = 1) =>
  `${formatLatitude(p.lat, decimals)} ${formatLongitude(p.lon, decimals)}`;

const formatKm = (km: number) => Math.round(km).toLocaleString('en-US');

/** The header's facts for a feature, each written once. */
export function featureFacts(feature: Feature): { label: string; value: string }[] {
  if (feature.type === 'point') {
    const p = featureCenter(feature);
    return p
      ? [{ label: 'Lat', value: formatLatitude(p.lat, 3) }, { label: 'Lon', value: formatLongitude(p.lon, 3) }]
      : [];
  }

  if (feature.type === 'line') {
    const positions = feature.metadata.positions ?? [];
    if (positions.length < 2) return [];
    return [
      { label: 'From', value: formatLonLat(toLonLat(positions[0])) },
      { label: 'To', value: formatLonLat(toLonLat(positions[positions.length - 1])) },
      { label: 'Length', value: `${formatKm(lineLengthM(positions) / 1000)} km` },
    ];
  }

  const center = featureCenter(feature);
  const area = featureAreaKm2(feature);
  return [
    ...(center ? [{ label: 'Center', value: formatLonLat(center) }] : []),
    ...(area !== null ? [{ label: 'Area', value: `${formatKm(area)} km²` }] : []),
  ];
}
