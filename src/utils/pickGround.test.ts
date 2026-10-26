import * as Cesium from 'cesium'
import { pickGround } from './pickGround'

const screen = new Cesium.Cartesian2(10, 20)
const onTerrain = new Cesium.Cartesian3(1, 2, 3)
const onEllipsoid = new Cesium.Cartesian3(4, 5, 6)
const ray = new Cesium.Ray()

function fakeViewer(terrain: Cesium.Cartesian3 | undefined, hasRay = true) {
  return {
    camera: { getPickRay: vi.fn(() => (hasRay ? ray : undefined)), pickEllipsoid: vi.fn(() => onEllipsoid) },
    scene: { globe: { pick: vi.fn(() => terrain), ellipsoid: Cesium.Ellipsoid.MOON } },
  }
}

it('picks the terrain under the cursor', () => {
  const viewer = fakeViewer(onTerrain)
  expect(pickGround(viewer as unknown as Cesium.CesiumWidget, screen)).toBe(onTerrain)
  expect(viewer.scene.globe.pick).toHaveBeenCalledWith(ray, viewer.scene)
})

it('falls back to the ellipsoid where no terrain answers', () => {
  const viewer = fakeViewer(undefined)
  expect(pickGround(viewer as unknown as Cesium.CesiumWidget, screen)).toBe(onEllipsoid)
  expect(viewer.camera.pickEllipsoid).toHaveBeenCalledWith(screen, Cesium.Ellipsoid.MOON)
})

it('falls back to the ellipsoid without a pick ray', () => {
  const viewer = fakeViewer(onTerrain, false)
  expect(pickGround(viewer as unknown as Cesium.CesiumWidget, screen)).toBe(onEllipsoid)
  expect(viewer.scene.globe.pick).not.toHaveBeenCalled()
})
