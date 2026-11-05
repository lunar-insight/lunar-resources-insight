// @vitest-environment node
import { describe, it, expect } from 'vitest'
import * as Cesium from 'cesium'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import {
  CIRCLE_VERTICES,
  LINE_SAMPLE_COUNT,
  MOON_RADIUS_M,
  circleRing,
  destination,
  featureAreaKm2,
  featureCenter,
  featureFacts,
  featureKind,
  formatLatitude,
  formatLongitude,
  geometryKey,
  gridInsideRing,
  isInsideBounds,
  isInsideRing,
  boundsIntersect,
  ringBounds,
  lineLengthM,
  localShape,
  project,
  ringAreaKm2,
  ringCenter,
  ringExtentKm,
  ringHoldsPole,
  ringNearMeridian,
  ringParts,
  sampleLine,
  shapeBounds,
  shapeParts,
  shapeRing,
  shapeWord,
  subdivideRing,
  unwrapRing,
} from './featureGeometry'

const deg = (lon: number, lat: number) => Cesium.Cartographic.fromDegrees(lon, lat)

const feature = (type: Feature['type'], metadata: Partial<Feature['metadata']>): Feature => ({
  id: 'f',
  type,
  name: 'F',
  entity: {} as Cesium.Entity,
  color: '#fff',
  metadata: { createdAt: new Date(0), ...metadata },
  inspectorOpen: false,
  visible: true,
})

const kmPerDegree = (Math.PI * MOON_RADIUS_M) / 180 / 1000

describe('featureKind and shapeWord', () => {
  it('sorts types into points, lines and shapes', () => {
    expect(featureKind('point')).toBe('point')
    expect(featureKind('line')).toBe('line')
    expect(featureKind('polygon')).toBe('shape')
    expect(featureKind('three-point-circle')).toBe('shape')
    expect(shapeWord('two-point-circle')).toBe('circle')
    expect(shapeWord('polygon')).toBe('polygon')
  })
})

describe('destination', () => {
  it('moves one degree of arc north and east', () => {
    const north = destination({ lon: 10, lat: 0 }, 0, kmPerDegree * 1000)
    expect(north.lat).toBeCloseTo(1, 6)
    expect(north.lon).toBeCloseTo(10, 6)
    const east = destination({ lon: 179.5, lat: 0 }, 90, kmPerDegree * 1000)
    expect(east.lon).toBeCloseTo(-179.5, 6)
  })
})

describe('shapes', () => {
  it('converts a circle to a ring of vertices at its radius', () => {
    const circle = feature('circle', { center: deg(20, 10), radius: 50_000 })
    const ring = shapeRing(circle)!
    expect(ring).toHaveLength(CIRCLE_VERTICES)
    const edge = new Cesium.EllipsoidGeodesic(deg(20, 10), deg(ring[7].lon, ring[7].lat), Cesium.Ellipsoid.MOON)
    expect(edge.surfaceDistance).toBeCloseTo(50_000, 0)
  })

  it('reads the center a move left on a center-radius circle', () => {
    const moved = feature('circle', { center: deg(5, 5), centerPosition: deg(0, 0), radius: 1000 })
    expect(featureCenter(moved)).toEqual({ lon: expect.closeTo(5), lat: expect.closeTo(5) })
    const threePoint = feature('three-point-circle', { centerPosition: deg(1, 2), radius: 1000 })
    expect(featureCenter(threePoint)!.lat).toBeCloseTo(2)
  })

  it('has no ring without enough vertices or a radius', () => {
    expect(shapeRing(feature('polygon', { positions: [deg(0, 0), deg(1, 0)] }))).toBeNull()
    expect(shapeRing(feature('circle', { center: deg(0, 0) }))).toBeNull()
    expect(featureAreaKm2(feature('circle', { center: deg(0, 0) }))).toBeNull()
  })

  it('measures a one degree box near the equator', () => {
    const area = ringAreaKm2([{ lon: 0, lat: 0 }, { lon: 1, lat: 0 }, { lon: 1, lat: 1 }, { lon: 0, lat: 1 }])
    expect(area).toBeCloseTo(kmPerDegree * kmPerDegree, -1)
  })

  it('measures a circle as its spherical cap, close to the polygon it becomes', () => {
    const circle = feature('two-point-circle', { centerPosition: deg(0, 30), radius: 100_000 })
    const cap = featureAreaKm2(circle)!
    expect(cap).toBeCloseTo(Math.PI * 100 * 100, -2)
    expect(ringAreaKm2(shapeRing(circle)!) / cap).toBeCloseTo(1, 2)
  })

  it('centers a polygon on the mean of its vertices across the 180° meridian', () => {
    const polygon = feature('polygon', { positions: [deg(179, 0), deg(-179, 0), deg(-179, 2), deg(179, 2)] })
    const center = featureCenter(polygon)!
    expect(Math.abs(center.lon)).toBeCloseTo(180, 5)
    expect(center.lat).toBeCloseTo(1, 2)
  })
})

describe('sampleLine', () => {
  const line = [deg(0, 0), deg(1, 0), deg(3, 0)]

  it('spreads samples evenly over the whole line and adds each vertex', () => {
    const samples = sampleLine(line)
    expect(samples).toHaveLength(LINE_SAMPLE_COUNT + 1)
    expect(samples[0].distanceKm).toBe(0)
    expect(samples[samples.length - 1].distanceKm).toBeCloseTo(3 * kmPerDegree, 3)
    expect(samples.some(s => Math.abs(s.lon - 1) < 1e-9)).toBe(true)
    samples.slice(1).forEach((s, i) => expect(s.distanceKm).toBeGreaterThan(samples[i].distanceKm))
  })

  it('places samples on the geodesic at their distance', () => {
    const samples = sampleLine(line, 4)
    expect(samples.map(s => s.lon)).toEqual([0, 1, 1, 2, 3].map(v => expect.closeTo(v, 6)))
  })

  it('reads one sample per vertex and the ends with a count of 1', () => {
    expect(sampleLine(line, 1).map(s => s.lon)).toEqual([0, 1, 3].map(v => expect.closeTo(v, 6)))
  })

  it('samples a line whose first vertex is repeated', () => {
    const samples = sampleLine([deg(0, 0), deg(0, 0), deg(2, 0)], 3)
    expect(samples.map(s => s.lon)).toEqual([0, 1, 2].map(v => expect.closeTo(v, 6)))
    expect(samples.map(s => s.lat)).toEqual([0, 0, 0].map(v => expect.closeTo(v, 6)))
  })

  it('handles lines with one point or none', () => {
    expect(sampleLine([])).toEqual([])
    expect(sampleLine([deg(2, 3)])).toEqual([{ lon: expect.closeTo(2), lat: expect.closeTo(3), distanceKm: 0 }])
  })

  it('measures the line length', () => {
    expect(lineLengthM(line) / 1000).toBeCloseTo(3 * kmPerDegree, 3)
  })
})

describe('geometryKey', () => {
  it('changes with the geometry only', () => {
    const a = feature('polygon', { positions: [deg(0, 0), deg(1, 0), deg(1, 1)] })
    const renamed = { ...a, name: 'Other', color: '#000' }
    const moved = feature('polygon', { positions: [deg(0, 0), deg(1, 0), deg(1, 2)] })
    expect(geometryKey(renamed)).toBe(geometryKey(a))
    expect(geometryKey(moved)).not.toBe(geometryKey(a))
    expect(geometryKey(feature('point', { position: deg(1, 1) }))).toMatch(/^point:/)
    expect(geometryKey(feature('circle', { center: deg(1, 1), radius: 5 }))).toMatch(/:5$/)
  })
})

describe('features without their geometry', () => {
  it('have no center, ring or area', () => {
    for (const f of [feature('point', {}), feature('line', {}), feature('polygon', {}), feature('circle', {})]) {
      expect(featureCenter(f)).toBeNull()
    }
    expect(shapeRing(feature('polygon', {}))).toBeNull()
    expect(featureAreaKm2(feature('polygon', { positions: [deg(0, 0), deg(1, 0)] }))).toBeNull()
  })

  it('keep a geometry key', () => {
    expect(geometryKey(feature('point', {}))).toBe('point:')
    expect(geometryKey(feature('line', {}))).toBe('line:')
    expect(geometryKey(feature('circle', {}))).toBe('circle::')
  })

  it('have no facts beyond those they hold', () => {
    expect(featureFacts(feature('line', {}))).toEqual([])
    expect(featureFacts(feature('circle', {}))).toEqual([])
  })
})

describe('circle centers', () => {
  it('reads a moved center-radius circle from center, other circles from centerPosition', () => {
    expect(featureCenter(feature('circle', { center: deg(5, 5), centerPosition: deg(1, 1) }))!.lon).toBeCloseTo(5)
    expect(featureCenter(feature('three-point-circle', { center: deg(5, 5), centerPosition: deg(1, 1) }))!.lon).toBeCloseTo(1)
  })

  it('falls back on the other field when one is missing', () => {
    expect(featureCenter(feature('circle', { centerPosition: deg(1, 1) }))!.lon).toBeCloseTo(1)
    expect(featureCenter(feature('two-point-circle', { center: deg(5, 5) }))!.lon).toBeCloseTo(5)
  })
})

describe('featureFacts', () => {
  it('gives a point its coordinates', () => {
    expect(featureFacts(feature('point', { position: deg(-3.634, 26.132) }))).toEqual([
      { label: 'Lat', value: '26.132°N' },
      { label: 'Lon', value: '3.634°W' },
    ])
    expect(featureFacts(feature('point', {}))).toEqual([])
  })

  it('gives a line its ends and length', () => {
    const facts = featureFacts(feature('line', { positions: [deg(-21.4, 38.1), deg(-16, 33.6)] }))
    expect(facts.map(f => f.label)).toEqual(['From', 'To', 'Length'])
    expect(facts[0].value).toBe('38.1°N 21.4°W')
    expect(facts[2].value).toMatch(/^\d[\d,]* km$/)
    expect(featureFacts(feature('line', { positions: [deg(0, 0)] }))).toEqual([])
  })

  it('gives a shape its center and area', () => {
    const facts = featureFacts(feature('circle', { center: deg(133.5, -75), radius: 160_000 }))
    expect(facts[0]).toEqual({ label: 'Center', value: '75.0°S 133.5°E' })
    expect(facts[1].value).toMatch(/^80,\d{3} km²$/)
  })
})

describe('rings and bounds', () => {
  const square = [{ lon: 0, lat: 0 }, { lon: 10, lat: 0 }, { lon: 10, lat: 10 }, { lon: 0, lat: 10 }]
  const triangle = [{ lon: 0, lat: 0 }, { lon: 10, lat: 0 }, { lon: 0, lat: 10 }]

  it('tests points inside a ring', () => {
    expect(isInsideRing({ lon: 5, lat: 5 }, square)).toBe(true)
    expect(isInsideRing({ lon: 8, lat: 8 }, triangle)).toBe(false)
    expect(isInsideRing({ lon: 2, lat: 2 }, triangle)).toBe(true)
  })

  it('samples a grid inside the ring', () => {
    const inSquare = gridInsideRing(square, 16)
    expect(inSquare).toHaveLength(16)
    const small = triangle.map(p => ({ lon: p.lon / 10, lat: p.lat / 10 }))
    const inTriangle = gridInsideRing(small, 16)
    expect(inTriangle.length).toBeLessThan(16)
    // Grid points can lie on the long edge, which runs along the grid's diagonal
    inTriangle.forEach(p => expect(p.lon + p.lat).toBeLessThan(1.001))
  })

  it('compares bounds', () => {
    expect(ringBounds(triangle)).toEqual([0, 0, 10, 10])
    expect(boundsIntersect([0, 0, 10, 10], [5, 5, 20, 20])).toBe(true)
    expect(boundsIntersect([0, 0, 10, 10], [-180, 49.8, 180, 90])).toBe(false)
    expect(isInsideBounds({ lon: 0, lat: 50 }, [-180, -50, 180, 50])).toBe(true)
    expect(isInsideBounds({ lon: 0, lat: 50.1 }, [-180, -50, 180, 50])).toBe(false)
  })
})

describe('rings across the 180° meridian', () => {
  // The 1° × 2° box of the statistics measured on LP GRS FeO, centered on 180°
  const crossing = [{ lon: 179.5, lat: -1 }, { lon: -179.5, lat: -1 }, { lon: -179.5, lat: 1 }, { lon: 179.5, lat: 1 }]
  const elsewhere = [{ lon: 9.5, lat: -1 }, { lon: 10.5, lat: -1 }, { lon: 10.5, lat: 1 }, { lon: 9.5, lat: 1 }]
  // Around the south pole, every longitude once
  const aroundPole = [0, 90, 180, -90].map(lon => ({ lon, lat: -85 }))

  it('unwraps to continuous longitudes, whichever side the ring starts on', () => {
    expect(unwrapRing(crossing).map(p => p.lon)).toEqual([179.5, 180.5, 180.5, 179.5])
    const fromWest = [crossing[1], crossing[2], crossing[3], crossing[0]]
    expect(unwrapRing(fromWest).map(p => p.lon)).toEqual([-179.5, -179.5, -180.5, -180.5])
    expect(unwrapRing(elsewhere)).toEqual(elsewhere)
  })

  it('leaves a ring around a pole as given, as it has no continuous form', () => {
    expect(unwrapRing(aroundPole)).toBe(aroundPole)
    expect(ringParts(aroundPole)).toEqual([aroundPole])
  })

  it('splits a ring first listed west of the meridian the same way', () => {
    const fromWest = [crossing[1], crossing[2], crossing[3], crossing[0]]
    const parts = ringParts(fromWest).map(ringBounds)
    expect(parts).toEqual(expect.arrayContaining([[179.5, -1, 180, 1], [-180, -1, -179.5, 1]]))
    expect(parts).toHaveLength(2)
  })

  it('inserts the crossing vertices at the interpolated latitude', () => {
    const slanted = [{ lon: 179, lat: 0 }, { lon: -179, lat: 2 }, { lon: 179, lat: 4 }]
    const [west, east] = ringParts(slanted)
    expect(west).toEqual([{ lon: 179, lat: 0 }, { lon: 180, lat: 1 }, { lon: 180, lat: 3 }, { lon: 179, lat: 4 }])
    expect(east).toEqual([{ lon: -180, lat: 1 }, { lon: -179, lat: 2 }, { lon: -180, lat: 3 }])
  })

  it('drops a part holding only vertices on the meridian', () => {
    const fromMeridian = [{ lon: -180, lat: 0 }, { lon: 179, lat: 0 }, { lon: 179, lat: 1 }, { lon: -180, lat: 1 }]
    expect(ringParts(fromMeridian)).toEqual([
      [{ lon: 180, lat: 0 }, { lon: 179, lat: 0 }, { lon: 179, lat: 1 }, { lon: 180, lat: 1 }],
    ])
  })

  it('measures the same area as the same box elsewhere at that latitude', () => {
    expect(ringAreaKm2(crossing)).toBeCloseTo(ringAreaKm2(elsewhere), 6)
  })

  it('gives bounds normalized to ±180°, west of the meridian first', () => {
    expect(ringBounds(crossing)).toEqual([179.5, -1, -179.5, 1])
    expect(ringBounds(elsewhere)).toEqual([9.5, -1, 10.5, 1])
  })

  it('gives each part its bounds', () => {
    expect(ringParts(crossing).map(ringBounds)).toEqual([[179.5, -1, 180, 1], [-180, -1, -179.5, 1]])
  })

  it('samples a grid inside the ring, normalized to ±180°', () => {
    const grid = gridInsideRing(crossing, 16)
    expect(grid).toHaveLength(16)
    grid.forEach(p => {
      expect(Math.abs(p.lon)).toBeGreaterThanOrEqual(179.5)
      expect(Math.abs(p.lon)).toBeLessThanOrEqual(180)
    })
    expect(grid.some(p => p.lon > 0)).toBe(true)
    expect(grid.some(p => p.lon < 0)).toBe(true)
  })

  it('normalizes a grid starting west of the meridian', () => {
    const fromWest = [crossing[1], crossing[2], crossing[3], crossing[0]]
    gridInsideRing(fromWest, 16).forEach(p => expect(Math.abs(p.lon)).toBeLessThanOrEqual(180))
  })
})

describe('shapes read in a local projection', () => {
  const square = [{ lon: 10, lat: 10 }, { lon: 14, lat: 10 }, { lon: 14, lat: 14 }, { lon: 10, lat: 14 }]
  const crossing = [{ lon: 179.5, lat: -1 }, { lon: -179.5, lat: -1 }, { lon: -179.5, lat: 1 }, { lon: 179.5, lat: 1 }]
  // The polygons measured against the files, near each latitude. Exact areas from the spherical polygon.
  const nearPole = [
    { ring: [[10, -87], [100, -87.2], [-170, -87.1], [-80, -87.3]], areaKm2: 14925 },
    { ring: [[30, -80], [150, -80], [-90, -80.5]], areaKm2: 116465 },
    { ring: [[0, -70], [72, -71], [144, -70], [-144, -72], [-72, -70]], areaKm2: 830336 },
  ].map(({ ring, areaKm2 }) => ({ ring: ring.map(([lon, lat]) => ({ lon, lat })), areaKm2 }))
  const polygon = (ring: { lon: number; lat: number }[]) =>
    feature('polygon', { positions: ring.map(p => deg(p.lon, p.lat)) })

  it('builds the ring of a circle centered exactly on a pole, around that pole', () => {
    ;[-90, 90].forEach(lat => {
      const ring = circleRing({ lon: 0, lat }, 150_000)
      expect(ringHoldsPole(ring)).toBe(true)
      ring.forEach(p => expect(Math.abs(p.lat)).toBeCloseTo(90 - (150_000 / MOON_RADIUS_M) * (180 / Math.PI), 6))
    })
  })

  it('heads along the expected meridian from a pole', () => {
    expect(destination({ lon: 0, lat: -90 }, 30, 100_000).lon).toBeCloseTo(30, 6)
    expect(destination({ lon: 0, lat: 90 }, 30, 100_000).lon).toBeCloseTo(150, 6)
  })

  it('tells which rings hold a pole', () => {
    nearPole.forEach(({ ring }) => expect(ringHoldsPole(ring)).toBe(true))
    expect(ringHoldsPole(square)).toBe(false)
    expect(ringHoldsPole(crossing)).toBe(false)
    expect(ringHoldsPole([...nearPole[0].ring].reverse())).toBe(true)
  })

  it('adds vertices along geodesics to edges over 5°, and none to shorter ones', () => {
    expect(subdivideRing(square)).toEqual(square)
    const [a, b] = [{ lon: 0, lat: -70 }, { lon: 120, lat: -70 }]
    const ring = subdivideRing([a, b, { lon: 120, lat: -60 }, { lon: 0, lat: -60 }])
    expect(ring[0]).toEqual(a)
    expect(ring.length).toBeGreaterThan(4)
    // The geodesic between them reaches about 79.7°S at its middle
    expect(Math.min(...ring.map(p => p.lat))).toBeCloseTo(-79.7, 0)
  })

  it('leaves a repeated vertex as it is', () => {
    const repeated = [{ lon: 1, lat: 1 }, { lon: 1, lat: 1 }, { lon: 2, lat: 1 }, { lon: 2, lat: 2 }]
    expect(subdivideRing(repeated)).toEqual(repeated)
  })

  it('gives a polygon its geodesic edges as its ring, and a small one its own vertices', () => {
    expect(shapeRing(polygon(nearPole[2].ring))!.length).toBeGreaterThan(5)
    expect(shapeRing(polygon(square))).toHaveLength(4)
  })

  it('measures a polygon around a pole as the spherical polygon, within 0.2%', () => {
    nearPole.forEach(({ ring, areaKm2 }) => {
      expect(featureAreaKm2(polygon(ring))! / areaKm2).toBeCloseTo(1, 2)
      expect(Math.abs(featureAreaKm2(polygon(ring))! / areaKm2 - 1)).toBeLessThan(0.002)
    })
  })

  it('measures the same polygon around the north pole', () => {
    const north = nearPole[1].ring.map(p => ({ lon: p.lon, lat: -p.lat }))
    expect(featureAreaKm2(polygon(north))! / nearPole[1].areaKm2).toBeCloseTo(1, 2)
  })

  it('samples the whole of a shape around a pole, up to the pole', () => {
    const center = { lon: 40, lat: -89 }
    const ring = circleRing(center, 120_000)
    const grid = gridInsideRing(ring, 144)
    expect(grid.length).toBeGreaterThan(90)
    expect(Math.min(...grid.map(p => 90 + p.lat))).toBeLessThan(0.5)
    grid.forEach(p => expect(Math.abs(p.lon)).toBeLessThanOrEqual(180))
    const radius = (p: { lon: number; lat: number }) => Math.hypot(project(p, center).x, project(p, center).y)
    grid.forEach(p => expect(radius(p)).toBeLessThan(121_000))
  })

  it('centers a ring on the mean of its vertices', () => {
    expect(ringCenter(square).lat).toBeCloseTo(12, 0)
    expect(Math.abs(ringCenter(crossing).lon)).toBeCloseTo(180, 6)
    expect(ringCenter(nearPole[0].ring).lat).toBeLessThan(-87)
  })

  it('sends a shape in meters around its center, closed, with that center as the CRS', () => {
    const { crs, geojson } = localShape(square)
    const center = ringCenter(square)
    expect(crs).toBe(`+proj=laea +lat_0=${center.lat} +lon_0=${center.lon} +R=${MOON_RADIUS_M} +units=m +no_defs +type=crs`)
    expect(geojson.type).toBe('Feature')
    expect(geojson.properties).toEqual({})
    expect(geojson.geometry.type).toBe('Polygon')
    const coordinates = geojson.geometry.coordinates[0]
    expect(coordinates).toHaveLength(5)
    expect(coordinates[4]).toEqual(coordinates[0])
    const first = project(square[0], center)
    expect(coordinates[0]).toEqual([first.x, first.y])
  })

  it('sends a ring around a pole or across 180° as one polygon in the same form', () => {
    expect(localShape(nearPole[0].ring).geojson.geometry.coordinates[0]).toHaveLength(5)
    expect(localShape(crossing).geojson.geometry.coordinates[0]).toHaveLength(5)
    localShape(crossing).geojson.geometry.coordinates[0].forEach(([x]) => expect(Math.abs(x)).toBeLessThan(40_000))
  })

  it('splits a shape into parts in degrees at 180°, each with its area', () => {
    const parts = shapeParts(crossing)
    expect(parts.map(part => part.geojson.geometry.coordinates[0])).toEqual([
      [[179.5, -1], [180, -1], [180, 1], [179.5, 1], [179.5, -1]],
      [[-180, -1], [-179.5, -1], [-179.5, 1], [-180, 1], [-180, -1]],
    ])
    expect(parts[0].areaKm2).toBeCloseTo(parts[1].areaKm2, 3)
    expect((parts[0].areaKm2 + parts[1].areaKm2) / ringAreaKm2(crossing)).toBeCloseTo(1, 4)
    expect(parts.map(part => part.heightDegrees)).toEqual([2, 2])
  })

  it('gives no height to a part of a ring on one parallel', () => {
    const flat = [{ lon: 179.6, lat: 45 }, { lon: -179.7, lat: 45 }, { lon: -179.4, lat: 45 }]
    expect(shapeParts(flat).map(part => part.heightDegrees)).toEqual([0, 0])
  })

  it('gives a ring not crossing one part', () => {
    const parts = shapeParts(square)
    expect(parts).toHaveLength(1)
    expect(parts[0].geojson.geometry.coordinates[0]).toHaveLength(5)
  })

  it('tells a ring reaching close to 180° from the others', () => {
    expect(ringNearMeridian(crossing)).toBe(true)
    expect(ringNearMeridian(square)).toBe(false)
    expect(ringNearMeridian([{ lon: 179.995, lat: 0 }, { lon: 179, lat: 0 }, { lon: 179, lat: 1 }])).toBe(true)
    expect(ringNearMeridian([{ lon: -179.995, lat: 0 }, { lon: -179, lat: 0 }, { lon: -179, lat: 1 }])).toBe(true)
    expect(ringNearMeridian([{ lon: 179.9, lat: 0 }, { lon: 179, lat: 0 }, { lon: 179, lat: 1 }])).toBe(false)
    expect(ringNearMeridian(nearPole[0].ring)).toBe(false)
  })

  it('measures the longer side of a ring on the ground', () => {
    expect(ringExtentKm(crossing)).toBeCloseTo(2 * kmPerDegree, -1)
    expect(ringExtentKm(circleRing({ lon: 0, lat: 0 }, 100_000))).toBeCloseTo(200, 0)
  })

  it('bounds a ring around a pole by every longitude up to that pole', () => {
    expect(shapeBounds(nearPole[0].ring)).toEqual([[-180, -90, 180, -87]])
    const north = nearPole[1].ring.map(p => ({ lon: p.lon, lat: -p.lat }))
    expect(shapeBounds(north)).toEqual([[-180, 80, 180, 90]])
  })

  it('bounds other rings by their parts', () => {
    expect(shapeBounds(square)).toEqual([[10, 10, 14, 14]])
    expect(shapeBounds(crossing)).toEqual([[179.5, -1, 180, 1], [-180, -1, -179.5, 1]])
  })
})

describe('coordinate formatting', () => {
  it('writes hemispheres as letters', () => {
    expect(formatLatitude(-12.345, 1)).toBe('12.3°S')
    expect(formatLongitude(0, 2)).toBe('0.00°E')
  })

  it('builds rings with the given vertex count', () => {
    expect(circleRing({ lon: 0, lat: 0 }, 1000, 8)).toHaveLength(8)
  })
})
