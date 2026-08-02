import * as Cesium from 'cesium'

const sampleTerrainHeightsMock = vi.fn()

vi.mock('services/TerrainService', () => ({
  TerrainService: {
    sampleTerrainHeights: (positions: Cesium.Cartographic[]) => sampleTerrainHeightsMock(positions),
  },
}))

import { computeSurfaceDistance, computeTerrainDistance } from './measurementDistance'

const a = Cesium.Cartographic.fromDegrees(10, 20, 0)
const b = Cesium.Cartographic.fromDegrees(10.5, 20.3, 0)

beforeEach(() => {
  sampleTerrainHeightsMock.mockReset()
})

describe('computeSurfaceDistance', () => {
  it('matches the ellipsoid geodesic surface distance', () => {
    const expected = new Cesium.EllipsoidGeodesic(a, b).surfaceDistance
    expect(computeSurfaceDistance(a, b)).toBe(expected)
  })

  it('is zero for identical points', () => {
    expect(computeSurfaceDistance(a, a)).toBe(0)
  })
})

describe('computeTerrainDistance', () => {
  it('returns 0 for identical points without sampling terrain', async () => {
    await expect(computeTerrainDistance(a, a)).resolves.toBe(0)
    expect(sampleTerrainHeightsMock).not.toHaveBeenCalled()
  })

  it('approximates the surface distance when sampled heights are flat', async () => {
    sampleTerrainHeightsMock.mockImplementation((positions: Cesium.Cartographic[]) =>
      Promise.resolve(positions.map((p) => Cesium.Cartographic.clone(p)))
    )

    const surfaceDistance = computeSurfaceDistance(a, b)
    const terrainDistance = await computeTerrainDistance(a, b)

    // Chord-summed distance along enough samples of a flat path should be
    // very close to (never more than) the true arc length.
    expect(terrainDistance).toBeLessThanOrEqual(surfaceDistance)
    expect(terrainDistance).toBeGreaterThan(surfaceDistance * 0.999)
  })

  it('is longer than the flat surface distance once elevation is added', async () => {
    sampleTerrainHeightsMock.mockImplementation((positions: Cesium.Cartographic[]) =>
      Promise.resolve(
        positions.map((p, i) => new Cesium.Cartographic(p.longitude, p.latitude, i % 2 === 0 ? 0 : 50))
      )
    )

    const surfaceDistance = computeSurfaceDistance(a, b)
    const terrainDistance = await computeTerrainDistance(a, b)

    expect(terrainDistance).toBeGreaterThan(surfaceDistance)
  })
})
