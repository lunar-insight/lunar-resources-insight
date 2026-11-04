// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  FRAME,
  PICTURE_HEIGHT,
  PICTURE_WIDTH,
  crossesMeridian,
  fromFrame,
  holdsPole,
  insideMask,
  localCrs,
  pointView,
  project,
  scaleBar,
  shapeView,
  toFrame,
  unproject,
  viewParts,
  viewSizeText,
} from './pictureGeometry'
import { circleRing, type LonLat } from './featureGeometry'

const widthOf = (view: { x0: number; x1: number }) => view.x1 - view.x0
const heightOf = (view: { y0: number; y1: number }) => view.y1 - view.y0

describe('project and unproject', () => {
  // From pyproj, +proj=laea on the Moon's sphere
  it.each([
    [{ lon: 0, lat: 0 }, { lon: 10, lat: 5 }, 301981.56238672783, 152146.50483324184],
    [{ lon: -50, lat: -64 }, { lon: -49, lat: -65 }, 12815.129398351775, -30423.69694770118],
    [{ lon: 30, lat: -89.99 }, { lon: 120, lat: -89.5 }, 15161.627160367414, -303.22484413598767],
    [{ lon: 180, lat: 2 }, { lon: -179, lat: 3 }, 30282.559852320475, 30333.34095831087],
    [{ lon: 180, lat: 2 }, { lon: 179, lat: 1 }, -30319.500897755304, -30314.885200963297],
  ])('matches PROJ on %o at %o', (center, point, x, y) => {
    const projected = project(point, center)
    expect(projected.x).toBeCloseTo(x, 3)
    expect(projected.y).toBeCloseTo(y, 3)
    const back = unproject(projected, center)
    expect(back.lat).toBeCloseTo(point.lat, 8)
    expect(back.lon).toBeCloseTo(point.lon, 8)
  })

  it('returns the center at the origin', () => {
    expect(unproject({ x: 0, y: 0 }, { lon: 12, lat: 34 })).toEqual({ lon: 12, lat: 34 })
  })

  it('wraps longitudes past 180° both ways', () => {
    expect(unproject(project({ lon: -179, lat: 0 }, { lon: 179, lat: 0 }), { lon: 179, lat: 0 }).lon).toBeCloseTo(-179, 8)
    expect(unproject(project({ lon: 179, lat: 0 }, { lon: -179, lat: 0 }), { lon: -179, lat: 0 }).lon).toBeCloseTo(179, 8)
  })
})

describe('localCrs', () => {
  it('writes the projection text', () => {
    expect(localCrs({ lon: 50.27, lat: -64.25 }))
      .toBe('+proj=laea +lat_0=-64.25 +lon_0=50.27 +R=1737400 +units=m +no_defs +type=crs')
  })
})

describe('pointView', () => {
  it.each([
    [0.059, 64 * 59],
    [1, 64_000],
    [2.6, 166_400],
    [15, 960_000],
    [30, 1_000_000],
  ])('takes 64 pixels of %f km across, at most 1000 km', (pixelKm, width) => {
    const view = pointView({ lon: 30, lat: 10 }, pixelKm)
    expect(widthOf(view)).toBeCloseTo(width, 3)
    expect(heightOf(view)).toBeCloseTo((width * FRAME.height) / FRAME.width, 3)
    expect(view.x0).toBeCloseTo(-width / 2, 3)
    expect(view.parts).toEqual([{ x0: view.x0, y0: view.y0, x1: view.x1, y1: view.y1, width: PICTURE_WIDTH, height: PICTURE_HEIGHT }])
  })
})

describe('shapeView', () => {
  const center = { lon: 40, lat: 10 }
  const boxRing = (halfWidthM: number, halfHeightM: number): LonLat[] => [
    unproject({ x: -halfWidthM, y: -halfHeightM }, center),
    unproject({ x: halfWidthM, y: -halfHeightM }, center),
    unproject({ x: halfWidthM, y: halfHeightM }, center),
    unproject({ x: -halfWidthM, y: halfHeightM }, center),
  ]

  it('fits a wide shape with a margin of 10% of its longer side', () => {
    const view = shapeView(boxRing(100_000, 10_000), center, 0.1)
    expect(widthOf(view)).toBeCloseTo(240_000, 0)
    expect(heightOf(view)).toBeCloseTo((240_000 * FRAME.height) / FRAME.width, 0)
  })

  it('fits a tall shape with a margin of 10% of its longer side', () => {
    const view = shapeView(boxRing(10_000, 100_000), center, 0.1)
    expect(heightOf(view)).toBeCloseTo(240_000, 0)
    expect(widthOf(view)).toBeCloseTo((240_000 * FRAME.width) / FRAME.height, 0)
  })

  it('holds a 500 m shape at 16 file pixels, and a 500 km one by its size', () => {
    expect(widthOf(shapeView(boxRing(250, 250), center, 1))).toBeCloseTo(16_000, 0)
    const large = shapeView(boxRing(250_000, 250_000), center, 1)
    expect(heightOf(large)).toBeCloseTo(600_000, 0)
  })

  it('takes 16 pixels as a minimum only', () => {
    expect(widthOf(shapeView(boxRing(250, 250), center, 0.001))).toBeCloseTo((600 * FRAME.width) / FRAME.height, 1)
  })

  it('centers on the shape, which need not sit on the projection center', () => {
    const ring = [{ lon: 41, lat: 11 }, { lon: 42, lat: 11 }, { lon: 42, lat: 12 }, { lon: 41, lat: 12 }]
    const view = shapeView(ring, center, 0.1)
    ring.forEach(p => {
      const { x, y } = project(p, center)
      expect(x).toBeGreaterThan(view.x0)
      expect(x).toBeLessThan(view.x1)
      expect(y).toBeGreaterThan(view.y0)
      expect(y).toBeLessThan(view.y1)
    })
  })
})

describe('boxes on 180°', () => {
  it('moves the projection to 180° for a point box across it, and splits in two', () => {
    const view = pointView({ lon: 179.9, lat: 2 }, 1)
    expect(view.center).toEqual({ lon: 180, lat: 2 })
    expect(crossesMeridian(view)).toBe(true)
    expect(view.parts).toHaveLength(2)
    expect(view.parts[0].x1).toBe(-5)
    expect(view.parts[1].x0).toBe(5)
    expect(view.parts[0].x0).toBe(view.x0)
    expect(view.parts[1].x1).toBe(view.x1)
    expect(view.parts[0].width + view.parts[1].width).toBe(422)
    expect(view.parts[0].height).toBe(300)
    expect(view.parts[0].width / 422).toBeCloseTo(-view.x0 / widthOf(view), 2)
  })

  it('keeps the point in the box after the projection moves', () => {
    const point = { lon: 179.9, lat: 2 }
    const view = pointView(point, 1)
    const { x, y } = project(point, view.center)
    const { px, py } = toFrame(x, y, view)
    expect(px).toBeCloseTo(FRAME.width / 2, 6)
    expect(py).toBeCloseTo(FRAME.height / 2, 6)
  })

  it('splits a shape across it, on both sides of the meridian', () => {
    const ring = [{ lon: 179.5, lat: -1 }, { lon: -179.5, lat: -1 }, { lon: -179.5, lat: 1 }, { lon: 179.5, lat: 1 }]
    const view = shapeView(ring, { lon: 180, lat: 0 }, 0.5)
    expect(view.parts).toHaveLength(2)
    expect(view.x0).toBeLessThan(0)
    expect(view.x1).toBeGreaterThan(0)
  })

  it('moves a shape box only when it crosses', () => {
    const near = [{ lon: 170, lat: 0 }, { lon: 171, lat: 0 }, { lon: 171, lat: 1 }]
    const view = shapeView(near, { lon: 170.5, lat: 0.5 }, 0.5)
    expect(view.center.lon).toBe(170.5)
    expect(view.parts).toHaveLength(1)
  })

  it('does not split a box near 180° not reaching it', () => {
    const view = pointView({ lon: 179, lat: 45 }, 0.059)
    expect(crossesMeridian(view)).toBe(false)
    expect(view.center.lon).toBe(179)
    expect(view.parts).toHaveLength(1)
  })

  it('does not split a box holding a pole', () => {
    const view = pointView({ lon: 30, lat: -89.99 }, 1)
    expect(holdsPole(view)).toBe(true)
    expect(crossesMeridian(view)).toBe(false)
    expect(view.center.lon).toBe(30)
    expect(view.parts).toHaveLength(1)
  })

  it('finds a pole in the north too, and none in a box away from them', () => {
    expect(holdsPole(pointView({ lon: 0, lat: 89.9 }, 1))).toBe(true)
    expect(holdsPole(pointView({ lon: 0, lat: 45 }, 1))).toBe(false)
  })

  it('keeps every part at least 1 pixel wide', () => {
    const box = { center: { lon: 180, lat: 0 }, x0: -6, y0: -1000, x1: 100_000, y1: 1000 }
    const parts = viewParts(box)
    expect(parts.map(part => part.width)).toEqual([1, 421])
  })

  it('makes one part of a box within the gap on one side', () => {
    const box = { center: { lon: 180, lat: 0 }, x0: -3, y0: -1000, x1: 100_000, y1: 1000 }
    expect(viewParts(box)).toEqual([{ x0: 5, y0: -1000, x1: 100_000, y1: 1000, width: 422, height: 300 }])
  })
})

describe('frame positions', () => {
  const view = { center: { lon: 0, lat: 0 }, x0: -1000, y0: -500, x1: 1000, y1: 500 }

  it('places the corners, north up', () => {
    expect(toFrame(-1000, 500, view)).toEqual({ px: 0, py: 0 })
    expect(toFrame(1000, -500, view)).toEqual({ px: FRAME.width, py: FRAME.height })
  })

  it('goes back', () => {
    const { px, py } = toFrame(250, -125, view)
    const back = fromFrame(px, py, view)
    expect(back.x).toBeCloseTo(250, 6)
    expect(back.y).toBeCloseTo(-125, 6)
  })
})

describe('scaleBar', () => {
  const across = (km: number) => ({ center: { lon: 0, lat: 0 }, x0: 0, y0: 0, x1: km * 1000, y1: 1 })

  it('takes the shortest round length of at least 18 px', () => {
    const bar = scaleBar(across(211))
    expect(bar.label).toBe('20 km')
    expect(bar.widthPx).toBeCloseTo(20, 6)
  })

  it('writes short lengths in meters', () => {
    expect(scaleBar(across(1)).label).toBe('100 m')
  })

  it('takes the longest step on a very wide box', () => {
    expect(scaleBar(across(1e7)).label).toBe('5000 km')
  })
})

describe('viewSizeText', () => {
  it('keeps one decimal under 100 km', () => {
    expect(viewSizeText({ center: { lon: 0, lat: 0 }, x0: 0, y0: 0, x1: 3776, y1: 2684 })).toBe('3.8 × 2.7 km')
  })

  it('rounds from 100 km', () => {
    expect(viewSizeText({ center: { lon: 0, lat: 0 }, x0: 0, y0: 0, x1: 960_000, y1: 682_000 })).toBe('960 × 682 km')
  })
})

describe('insideMask', () => {
  const center = { lon: 0, lat: 0 }
  const view = { center, x0: -1000, y0: -1000, x1: 1000, y1: 1000 }
  const square = [{ x: -500, y: -500 }, { x: 500, y: -500 }, { x: 500, y: 500 }, { x: -500, y: 500 }]
    .map(p => unproject(p, center))

  it('marks the pixels whose center is inside', () => {
    const mask = insideMask(square, view, 4, 4)
    expect([...mask]).toEqual([
      0, 0, 0, 0,
      0, 1, 1, 0,
      0, 1, 1, 0,
      0, 0, 0, 0,
    ])
  })

  it('stays in the array for a ring larger than the view', () => {
    const large = [{ x: -5000, y: -5000 }, { x: 5000, y: -5000 }, { x: 5000, y: 5000 }, { x: -5000, y: 5000 }]
      .map(p => unproject(p, center))
    expect(insideMask(large, view, 2, 2).every(value => value === 1)).toBe(true)
  })

  it('leaves a gap in a concave ring', () => {
    const notched = [
      { x: -800, y: -800 }, { x: 800, y: -800 }, { x: 800, y: 800 }, { x: 200, y: 800 },
      { x: 200, y: -200 }, { x: -200, y: -200 }, { x: -200, y: 800 }, { x: -800, y: 800 },
    ].map(p => unproject(p, center))
    const mask = insideMask(notched, view, 8, 8)
    expect(mask[8 * 1 + 3]).toBe(0)
    expect(mask[8 * 1 + 1]).toBe(1)
    expect(mask[8 * 6 + 3]).toBe(1)
  })

  it('agrees with a circle', () => {
    const ring = circleRing(center, 800)
    const mask = insideMask(ring, view, 100, 100)
    const share = mask.reduce((sum, value) => sum + value, 0) / mask.length
    expect(share).toBeCloseTo((Math.PI * 0.8 * 0.8) / 4, 1)
  })
})
