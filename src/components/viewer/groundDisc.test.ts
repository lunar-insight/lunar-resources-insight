import * as Cesium from 'cesium'
import { createGroundDisc, keepShadersCompiled } from './groundDisc'

// Cesium's Material tells uniform types apart with image types jsdom lacks.
vi.stubGlobal('ImageBitmap', class {})
vi.stubGlobal('OffscreenCanvas', class {})

const center = Cesium.Cartesian3.fromDegrees(10, 20, 0, Cesium.Ellipsoid.MOON)
const material = () => Cesium.Material.fromType('Color')

function fakeViewer() {
  return {
    scene: {
      groundPrimitives: { add: vi.fn(<T,>(primitive: T) => primitive), remove: vi.fn() },
      postRender: new Cesium.Event(),
      requestRender: vi.fn(),
      canvas: { clientWidth: 800, clientHeight: 600 },
      globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    },
    camera: { pickEllipsoid: vi.fn((): Cesium.Cartesian3 | undefined => center) },
  }
}

type Viewer = ReturnType<typeof fakeViewer>
const asViewer = (viewer: Viewer) => viewer as unknown as Cesium.Viewer
const added = (viewer: Viewer) => viewer.scene.groundPrimitives.add.mock.calls.map(([primitive]) => primitive as Cesium.GroundPrimitive)
const radius = (primitive: Cesium.GroundPrimitive) =>
  ((primitive.geometryInstances as Cesium.GeometryInstance).geometry as unknown as { _semiMajorAxis: number })._semiMajorAxis
const setReady = (viewer: Viewer) => added(viewer).forEach(disc => {
  Object.defineProperty(disc, 'ready', { get: () => true })
})

describe('createGroundDisc', () => {
  it('drapes a disc of the radius on the ground, built at once and left out of picking', () => {
    const disc = createGroundDisc(asViewer(fakeViewer()), center, 500, material())
    expect(disc).toBeInstanceOf(Cesium.GroundPrimitive)
    expect(radius(disc)).toBe(500)
    expect(disc.allowPicking).toBe(false)
    expect(disc.appearance).toBeInstanceOf(Cesium.MaterialAppearance)
  })
})

describe('keepShadersCompiled', () => {
  it('draws a small and a large disc at the view center, then hides them', () => {
    const viewer = fakeViewer()
    keepShadersCompiled(asViewer(viewer), 'test', material)

    const discs = added(viewer)
    expect(discs.map(radius)).toEqual([1_000, 300_000])
    expect(viewer.camera.pickEllipsoid).toHaveBeenCalledWith(new Cesium.Cartesian2(400, 300), Cesium.Ellipsoid.MOON)

    // Not built yet: drawn again on the next frame.
    viewer.scene.postRender.raiseEvent()
    expect(discs.every(disc => disc.show)).toBe(true)
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(2)

    setReady(viewer)
    viewer.scene.postRender.raiseEvent()
    expect(discs.every(disc => !disc.show)).toBe(true)
    expect(viewer.scene.postRender.numberOfListeners).toBe(0)
    expect(viewer.scene.groundPrimitives.remove).not.toHaveBeenCalled()
  })

  it('hides the discs after a while even if they never build', () => {
    const viewer = fakeViewer()
    keepShadersCompiled(asViewer(viewer), 'test', material)
    for (let i = 0; i < 120; i++) viewer.scene.postRender.raiseEvent()
    expect(added(viewer).every(disc => !disc.show)).toBe(true)
    expect(viewer.scene.postRender.numberOfListeners).toBe(0)
  })

  it('prepares each material once per viewer', () => {
    const viewer = fakeViewer()
    keepShadersCompiled(asViewer(viewer), 'first', material)
    keepShadersCompiled(asViewer(viewer), 'first', material)
    keepShadersCompiled(asViewer(viewer), 'second', material)
    expect(added(viewer)).toHaveLength(4)
  })

  it('waits for the globe to be in view', () => {
    const viewer = fakeViewer()
    viewer.camera.pickEllipsoid.mockReturnValueOnce(undefined)
    keepShadersCompiled(asViewer(viewer), 'test', material)
    expect(added(viewer)).toHaveLength(0)

    keepShadersCompiled(asViewer(viewer), 'test', material)
    expect(added(viewer)).toHaveLength(2)
  })
})
