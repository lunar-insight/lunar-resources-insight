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

/** A polygon's edge is drawn as a geodesic and read as straight, so it gets vertices at this spacing. */
const MAX_EDGE_DEGREES = 5;

/**
 * Below this distance from 180°, a warped read can reach that meridian, as the
 * tiler moves the edges of its read outward onto a grid of the whole file.
 */
const MERIDIAN_MARGIN_DEGREES = 0.01;

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
  // Free of the cos(phi1) factor that leaves only rounding noise at a pole.
  const lambda2 = lambda1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta),
    Math.cos(delta) * Math.cos(phi1) - Math.sin(phi1) * Math.sin(delta) * Math.cos(theta),
  );

  return {
    lon: Cesium.Math.toDegrees(Cesium.Math.negativePiToPi(lambda2)),
    lat: Cesium.Math.toDegrees(phi2),
  };
}

export function circleRing(center: LonLat, radiusM: number, vertices = CIRCLE_VERTICES): LonLat[] {
  return Array.from({ length: vertices }, (_, i) => destination(center, (360 * i) / vertices, radiusM));
}

const toUnitVector = ({ lon, lat }: LonLat): [number, number, number] => {
  const phi = Cesium.Math.toRadians(lat);
  const lambda = Cesium.Math.toRadians(lon);
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)];
};

/** The ring with vertices added along its geodesic edges, so no piece spans over `maxDegrees`. */
export function subdivideRing(ring: LonLat[], maxDegrees = MAX_EDGE_DEGREES): LonLat[] {
  return ring.flatMap((from, index) => {
    const a = toUnitVector(from);
    const b = toUnitVector(ring[(index + 1) % ring.length]);
    const arc = Math.atan2(
      Math.hypot(a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]),
      a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    );
    const pieces = Math.ceil(Cesium.Math.toDegrees(arc) / maxDegrees);
    if (pieces <= 1) return [from];

    return Array.from({ length: pieces }, (_, piece) => {
      if (piece === 0) return from;
      const share = piece / pieces;
      const fromA = Math.sin((1 - share) * arc) / Math.sin(arc);
      const fromB = Math.sin(share * arc) / Math.sin(arc);
      const [x, y, z] = a.map((value, axis) => fromA * value + fromB * b[axis]);
      return {
        lon: Cesium.Math.toDegrees(Math.atan2(y, x)),
        lat: Cesium.Math.toDegrees(Math.atan2(z, Math.hypot(x, y))),
      };
    });
  });
}

/** Vertices of a shape feature, unclosed, following its geodesic edges. A circle becomes a polygon. */
export function shapeRing(feature: Feature): LonLat[] | null {
  if (feature.type === 'polygon') {
    const positions = feature.metadata.positions ?? [];
    return positions.length >= 3 ? subdivideRing(positions.map(toLonLat)) : null;
  }
  const center = circleCenter(feature);
  const radius = feature.metadata.radius;
  if (!center || !radius) return null;
  return circleRing(toLonLat(center), radius);
}

const wrapLon = (lon: number) => (lon > 180 ? lon - 360 : lon < -180 ? lon + 360 : lon);

/** Continuous longitudes, adding 360° at a jump over 180°, and the offset left on closing the ring. */
function continuousRing(ring: LonLat[]): { unwrapped: LonLat[]; closingOffset: number } {
  let offset = 0;
  const offsetAfter = (from: LonLat, to: LonLat) => {
    const step = to.lon - from.lon;
    if (step > 180) offset -= 360;
    else if (step < -180) offset += 360;
  };
  const unwrapped = ring.map((p, i) => {
    if (i > 0) offsetAfter(ring[i - 1], p);
    return { lon: p.lon + offset, lat: p.lat };
  });
  offsetAfter(ring[ring.length - 1], ring[0]);
  return { unwrapped, closingOffset: offset };
}

/** A ring going once around the Moon's axis holds one pole. */
export function ringHoldsPole(ring: LonLat[]): boolean {
  return continuousRing(ring).closingOffset !== 0;
}

/** The ring with continuous longitudes. A ring around a pole has no continuous form and stays as given. */
export function unwrapRing(ring: LonLat[]): LonLat[] {
  const { unwrapped, closingOffset } = continuousRing(ring);
  return closingOffset === 0 ? unwrapped : ring;
}

/** Whether a ring not holding a pole crosses 180° or comes close enough that a warped read can reach it. */
export function ringNearMeridian(ring: LonLat[]): boolean {
  if (ringHoldsPole(ring)) return false;
  const lons = unwrapRing(ring).map(p => p.lon);
  return Math.max(...lons) >= 180 - MERIDIAN_MARGIN_DEGREES || Math.min(...lons) <= -180 + MERIDIAN_MARGIN_DEGREES;
}

export function localCrs(center: LonLat): string {
  return `+proj=laea +lat_0=${center.lat} +lon_0=${center.lon} +R=${MOON_RADIUS_M} +units=m +no_defs +type=crs`;
}

/** Lambert azimuthal equal-area, in meters around `center`. */
export function project(p: LonLat, center: LonLat): { x: number; y: number } {
  const phi = Cesium.Math.toRadians(p.lat);
  const phi0 = Cesium.Math.toRadians(center.lat);
  const delta = Cesium.Math.toRadians(p.lon - center.lon);
  const k = Math.sqrt(2 / (1 + Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(delta)));
  return {
    x: MOON_RADIUS_M * k * Math.cos(phi) * Math.sin(delta),
    y: MOON_RADIUS_M * k * (Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(delta)),
  };
}

export function unproject({ x, y }: { x: number; y: number }, center: LonLat): LonLat {
  const rho = Math.hypot(x, y);
  if (rho === 0) return { lon: center.lon, lat: center.lat };

  const c = 2 * Math.asin(rho / (2 * MOON_RADIUS_M));
  const phi0 = Cesium.Math.toRadians(center.lat);
  const lat = Math.asin(Math.cos(c) * Math.sin(phi0) + (y * Math.sin(c) * Math.cos(phi0)) / rho);
  const delta = Math.atan2(x * Math.sin(c), rho * Math.cos(phi0) * Math.cos(c) - y * Math.sin(phi0) * Math.sin(c));
  const lon = center.lon + Cesium.Math.toDegrees(delta);
  return { lon: wrapLon(lon), lat: Cesium.Math.toDegrees(lat) };
}

/** The part of a continuous ring on one side of a meridian: `side` 1 keeps east of it, -1 west. */
function clipAtMeridian(ring: LonLat[], meridian: number, side: 1 | -1): LonLat[] {
  const isKept = (p: LonLat) => (p.lon - meridian) * side >= 0;
  const clipped: LonLat[] = [];
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    if (isKept(a)) clipped.push(a);
    if (isKept(a) !== isKept(b)) {
      const share = (meridian - a.lon) / (b.lon - a.lon);
      clipped.push({ lon: meridian, lat: a.lat + share * (b.lat - a.lat) });
    }
  });
  return clipped;
}

/** The ring in ±180° longitudes: itself, or its two parts split at 180°. */
export function ringParts(ring: LonLat[]): LonLat[][] {
  const unwrapped = unwrapRing(ring);
  const lons = unwrapped.map(p => p.lon);
  const meridian = Math.max(...lons) > 180 ? 180 : Math.min(...lons) < -180 ? -180 : null;
  if (meridian === null) return [unwrapped];

  // A side holding only vertices on the meridian has no area. The part beyond
  // ±180° comes back by 360°, and its edge on the meridian with it.
  const part = (side: 1 | -1, by: number) => {
    const clipped = clipAtMeridian(unwrapped, meridian, side);
    return clipped.some(p => p.lon !== meridian) ? [clipped.map(p => ({ lon: p.lon + by, lat: p.lat }))] : [];
  };
  return [...part(-1, meridian < 0 ? 360 : 0), ...part(1, meridian > 0 ? -360 : 0)];
}

const polygonFeature = (vertices: number[][]) => ({
  type: 'Feature' as const,
  properties: {},
  geometry: { type: 'Polygon' as const, coordinates: [[...vertices, vertices[0]]] },
});

/** A shape as one read: a closed GeoJSON Feature in meters around its center, and that projection. */
export function localShape(ring: LonLat[]) {
  const center = ringCenter(ring);
  return {
    crs: localCrs(center),
    geojson: polygonFeature(ring.map(p => {
      const { x, y } = project(p, center);
      return [x, y];
    })),
  };
}

/** Area of a ring on the Moon's sphere, in km², from its equal-area projection. */
export function ringAreaKm2(ring: LonLat[]): number {
  const center = ringCenter(ring);
  const points = ring.map(p => project(p, center));
  const doubled = points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length];
    return sum + a.x * b.y - b.x * a.y;
  }, 0);
  return Math.abs(doubled) / 2 / 1e6;
}

/** A shape as parts in degrees, split at 180°, each a closed GeoJSON Feature with its area and its span in latitude. */
export function shapeParts(ring: LonLat[]) {
  return ringParts(ring).map(part => {
    const lats = part.map(p => p.lat);
    return {
      geojson: polygonFeature(part.map(p => [p.lon, p.lat])),
      areaKm2: ringAreaKm2(part),
      heightDegrees: Math.max(...lats) - Math.min(...lats),
    };
  });
}

/** The longer side of a ring's box in its local projection, in km. */
export function ringExtentKm(ring: LonLat[]): number {
  const center = ringCenter(ring);
  const points = ring.map(p => project(p, center));
  const span = (values: number[]) => Math.max(...values) - Math.min(...values);
  return Math.max(span(points.map(p => p.x)), span(points.map(p => p.y))) / 1000;
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

/** Where a ring's local projection is centered. */
export const ringCenter = meanPosition;

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
  // Capped at the total, so every distance falls within a segment despite rounding
  for (let i = 0; i < count; i++) distances.add(count === 1 ? 0 : Math.min(total, (total * i) / (count - 1)));
  segments.forEach(segment => distances.add(segment.start));
  distances.add(total);

  return [...distances].sort((a, b) => a - b).map(distance => {
    const segment = segments.find(s => distance <= s.start + s.length);
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

/** About `target` points inside a ring, evenly spread over the ground. */
export function gridInsideRing(ring: LonLat[], target = 144): LonLat[] {
  const center = ringCenter(ring);
  // In the projection's meters, held in the fields isInsideRing reads
  const planar = ring.map(p => {
    const { x, y } = project(p, center);
    return { lon: x, lat: y };
  });
  const xs = planar.map(p => p.lon);
  const ys = planar.map(p => p.lat);
  const west = Math.min(...xs), east = Math.max(...xs);
  const south = Math.min(...ys), north = Math.max(...ys);
  const steps = Math.max(2, Math.round(Math.sqrt(target)));

  const points: LonLat[] = [];
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const lon = west + ((east - west) * (i + 0.5)) / steps;
      const lat = south + ((north - south) * (j + 0.5)) / steps;
      if (isInsideRing({ lon, lat }, planar)) points.push(unproject({ x: lon, y: lat }, center));
    }
  }
  return points;
}

/**
 * Bounding box [west, south, east, north] in degrees. West exceeds east for a
 * ring across 180°, so compare against the bounds of its `ringParts`.
 */
export function ringBounds(ring: LonLat[]): number[] {
  const unwrapped = unwrapRing(ring);
  const lons = unwrapped.map(p => p.lon);
  const lats = unwrapped.map(p => p.lat);
  return [wrapLon(Math.min(...lons)), Math.min(...lats), wrapLon(Math.max(...lons)), Math.max(...lats)];
}

/** Bounding boxes of a shape, none across 180°. A ring around a pole reaches that pole at every longitude. */
export function shapeBounds(ring: LonLat[]): number[][] {
  if (!ringHoldsPole(ring)) return ringParts(ring).map(ringBounds);
  const lats = ring.map(p => p.lat);
  return [ringCenter(ring).lat < 0
    ? [-180, -90, 180, Math.max(...lats)]
    : [-180, Math.min(...lats), 180, 90]];
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
