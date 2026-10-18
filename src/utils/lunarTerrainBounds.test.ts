import * as Cesium from 'cesium'
import { applyLunarTerrainBounds, LUNAR_MAX_TERRAIN_HEIGHT } from './lunarTerrainBounds'

it('gives every tile bounds covering the whole Moon', async () => {
  applyLunarTerrainBounds()
  const table = (Cesium as any).ApproximateTerrainHeights
  await table.initialize()

  // The Earth table puts this spot between -114 and 1,703 m, missing the Moon's -956 m.
  const rectangle = Cesium.Rectangle.fromDegrees(-50.55, 22.53, -50.45, 22.63)
  const { minimumTerrainHeight, maximumTerrainHeight } = table.getMinimumMaximumHeights(rectangle, Cesium.Ellipsoid.MOON)
  expect(minimumTerrainHeight).toBeLessThanOrEqual(-10_000)
  expect(maximumTerrainHeight).toBe(LUNAR_MAX_TERRAIN_HEIGHT)
  expect(table.initialized).toBe(true)
})
