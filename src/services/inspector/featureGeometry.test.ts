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
  ringAreaKm2,
  ringToGeoJson,
  sampleLine,
  shapeRing,
  shapeWord,
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

  it('closes the GeoJSON ring', () => {
    const geojson = ringToGeoJson([{ lon: 0, lat: 0 }, { lon: 1, lat: 0 }, { lon: 1, lat: 1 }])
    expect(geojson.geometry.coordinates[0]).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]])
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

  it('samples a grid inside the ring plus its vertices', () => {
    const inSquare = gridInsideRing(square, 16)
    expect(inSquare).toHaveLength(16 + 4)
    const inTriangle = gridInsideRing(triangle, 16)
    expect(inTriangle.length).toBeLessThan(16 + 3)
    inTriangle.slice(0, -3).forEach(p => expect(isInsideRing(p, triangle)).toBe(true))
  })

  it('compares bounds', () => {
    expect(ringBounds(triangle)).toEqual([0, 0, 10, 10])
    expect(boundsIntersect([0, 0, 10, 10], [5, 5, 20, 20])).toBe(true)
    expect(boundsIntersect([0, 0, 10, 10], [-180, 49.8, 180, 90])).toBe(false)
    expect(isInsideBounds({ lon: 0, lat: 50 }, [-180, -50, 180, 50])).toBe(true)
    expect(isInsideBounds({ lon: 0, lat: 50.1 }, [-180, -50, 180, 50])).toBe(false)
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
