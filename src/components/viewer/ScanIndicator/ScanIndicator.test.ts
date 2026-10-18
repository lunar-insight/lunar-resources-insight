import * as Cesium from 'cesium'

const { groundDisc, picked } = vi.hoisted(() => ({
  groundDisc: {
    createGroundDisc: vi.fn((_viewer: unknown, center: unknown, radius: number, _material: unknown) => ({ center, radius, show: true })),
    keepShadersCompiled: vi.fn(),
  },
  picked: { position: undefined as unknown },
}))
vi.mock('../groundDisc', () => groundDisc)
vi.mock('utils/pickGround', () => ({ pickGround: () => picked.position }))

// Cesium's Material tells uniform types apart with image types jsdom lacks.
vi.stubGlobal('ImageBitmap', class {})
vi.stubGlobal('OffscreenCanvas', class {})

import { ScanIndicator, indicatorShape } from './ScanIndicator'

const ellipsoid = Cesium.Ellipsoid.MOON
const at = (lon: number, lat: number, height = 0) => Cesium.Cartesian3.fromDegrees(lon, lat, height, ellipsoid)
const screen = new Cesium.Cartesian2(10, 20)
// 600 px of canvas height and a camera 60 km up: 100 m per pixel.
const CAMERA_HEIGHT = 60_000
const METERS_PER_PIXEL = 100
// Eight times the largest ring at its widest: 6 times the 1.375 px dot, 40% larger.
const DISC_RADIUS = 8 * 1.375 * METERS_PER_PIXEL * 6 * 1.4

function fakeViewer() {
  return {
    scene: {
      groundPrimitives: { add: vi.fn(<T,>(primitive: T) => primitive), remove: vi.fn() },
      preRender: new Cesium.Event(),
      requestRender: vi.fn(),
      canvas: { clientWidth: 800, clientHeight: 600 },
      globe: { ellipsoid },
    },
    camera: { position: at(10, 20, CAMERA_HEIGHT), viewMatrix: Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY) },
  }
}

type Viewer = ReturnType<typeof fakeViewer>
const asViewer = (viewer: Viewer) => viewer as unknown as Cesium.Viewer
type Disc = { center: Cesium.Cartesian3; radius: number; show: boolean }
const discs = (viewer: Viewer) => viewer.scene.groundPrimitives.add.mock.calls.map(([disc]) => disc as unknown as Disc)
const uniforms = () => (groundDisc.createGroundDisc.mock.calls.at(-1)![3] as unknown as Cesium.Material).uniforms

function frame(viewer: Viewer, ms = 16) {
  vi.advanceTimersByTime(ms)
  viewer.scene.preRender.raiseEvent()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'] })
  groundDisc.createGroundDisc.mockClear()
  groundDisc.keepShadersCompiled.mockClear()
  picked.position = at(10, 20)
})
afterEach(() => { vi.useRealTimers() })

describe('following the cursor', () => {
  it('draws on the ground under the cursor, sized in screen pixels', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))

    expect(indicator.updatePosition(screen)).toBe(true)
    expect(indicator.isActive()).toBe(true)
    const [disc] = discs(viewer)
    expect(disc.center).toEqual(at(10, 20))
    expect(disc.radius).toBeCloseTo(DISC_RADIUS)

    // The view matrix is the identity here, so eye coordinates are world coordinates.
    expect(uniforms().cursor).toEqual(at(10, 20))
    const up = ellipsoid.geodeticSurfaceNormal(at(10, 20))
    expect(Cesium.Cartesian3.equalsEpsilon(uniforms().up, up, 1e-12)).toBe(true)
    expect(uniforms().pixel).toBeCloseTo(METERS_PER_PIXEL)
    expect(Cesium.Cartesian4.equalsEpsilon(uniforms().radii, indicatorShape(0, METERS_PER_PIXEL).radii, 1e-6)).toBe(true)
  })

  it('moves within its disc without building a new one', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)

    picked.position = at(10.01, 20)
    indicator.updatePosition(screen)
    frame(viewer)
    expect(discs(viewer)).toHaveLength(1)
    expect(uniforms().cursor).toEqual(at(10.01, 20))
  })

  it('builds a new disc once the cursor nears the edge, before removing the old one', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)

    picked.position = at(11, 20)
    indicator.updatePosition(screen)
    frame(viewer)
    const [first, second] = discs(viewer)
    expect(second.center).toEqual(at(11, 20))
    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalledWith(first)
    expect(viewer.scene.groundPrimitives.add.mock.invocationCallOrder[1])
      .toBeLessThan(viewer.scene.groundPrimitives.remove.mock.invocationCallOrder[0])
  })

  it('builds a new disc when the zoom changes its size a lot', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)

    viewer.camera.position = at(10, 20, CAMERA_HEIGHT * 1.5)
    frame(viewer)
    expect(discs(viewer)).toHaveLength(1)

    viewer.camera.position = at(10, 20, CAMERA_HEIGHT * 3)
    frame(viewer)
    expect(discs(viewer)).toHaveLength(2)
    expect(discs(viewer)[1].radius).toBeCloseTo(DISC_RADIUS * 3)

    viewer.camera.position = at(10, 20, CAMERA_HEIGHT / 2)
    frame(viewer)
    expect(discs(viewer)).toHaveLength(3)
  })

  it('treats a camera below 1 km above the ground as 1 km up', () => {
    const viewer = fakeViewer()
    viewer.camera.position = at(10, 20, 200)
    new ScanIndicator(asViewer(viewer)).updatePosition(screen)
    expect(uniforms().pixel).toBeCloseTo(1000 / 600)
  })

  it('hides off the globe, keeping its disc for later', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)

    picked.position = undefined
    expect(indicator.updatePosition(screen)).toBe(false)
    expect(indicator.isActive()).toBe(false)
    expect(discs(viewer)[0].show).toBe(false)
    expect(viewer.scene.groundPrimitives.remove).not.toHaveBeenCalled()

    picked.position = at(10, 20)
    indicator.updatePosition(screen)
    expect(discs(viewer)).toHaveLength(1)
    expect(discs(viewer)[0].show).toBe(true)
  })

  it('shows at a world position, independent of the cursor', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.showAt(at(12, 21))
    expect(indicator.isActive()).toBe(true)
    expect(uniforms().cursor).toEqual(at(12, 21))
  })
})

describe('animating', () => {
  it('pulses on every frame while shown, and stops once hidden', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(1)

    frame(viewer, 500)
    expect(viewer.scene.requestRender.mock.calls.length).toBeGreaterThan(10)
    expect(Cesium.Cartesian4.equalsEpsilon(uniforms().alphas, indicatorShape(500, METERS_PER_PIXEL).alphas, 1e-6)).toBe(true)

    indicator.hide()
    const renders = viewer.scene.requestRender.mock.calls.length
    vi.advanceTimersByTime(500)
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(renders)
    expect(viewer.scene.preRender.numberOfListeners).toBe(0)
  })

  it('draws the dot and the rings at the scan indicator sizes', () => {
    const start = indicatorShape(0, 10)
    expect(start.radii.x).toBeCloseTo(13.75)
    expect(start.alphas.x).toBeCloseTo(0.9)
    expect(start.radii.y).toBeCloseTo(27.5)
    expect(start.alphas.y).toBeCloseTo(0.3)

    // A quarter of the dot's period: the dot at its largest and most opaque.
    const quarter = indicatorShape(500, 10)
    expect(quarter.radii.x).toBeCloseTo(13.75 * 1.3)
    expect(quarter.alphas.x).toBeCloseTo(1)
    // The rings never shrink below the dot's size, nor fade below 5%.
    expect(Math.min(quarter.radii.z, quarter.radii.w)).toBeGreaterThanOrEqual(13.75)
    // The largest ring is at its faintest three quarters into its period, after its 1 s delay.
    expect(indicatorShape(4000, 10).alphas.w).toBeCloseTo(0.05)
  })
})

describe('its viewer', () => {
  it('compiles its shaders once the browser is idle', () => {
    const viewer = fakeViewer()
    new ScanIndicator(asViewer(viewer))
    expect(groundDisc.keepShadersCompiled).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(groundDisc.keepShadersCompiled).toHaveBeenCalledWith(viewer, 'scan-indicator', expect.any(Function))
    expect(groundDisc.keepShadersCompiled.mock.calls[0][2]()).toBeInstanceOf(Cesium.Material)
  })

  it('is removed from the scene when destroyed or given another viewer', () => {
    const viewer = fakeViewer()
    const indicator = new ScanIndicator(asViewer(viewer))
    indicator.updatePosition(screen)
    indicator.setViewer(asViewer(viewer))
    expect(viewer.scene.groundPrimitives.remove).not.toHaveBeenCalled()

    indicator.setViewer(null)
    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalledWith(discs(viewer)[0])
    expect(indicator.isActive()).toBe(false)
    vi.runAllTimers()
    expect(groundDisc.keepShadersCompiled).not.toHaveBeenCalled()
  })

  it('does nothing without a viewer', () => {
    const indicator = new ScanIndicator()
    expect(indicator.updatePosition(screen)).toBe(false)
    indicator.showAt(at(10, 20))
    indicator.hide()
    indicator.destroy()
    expect(indicator.isActive()).toBe(false)
  })
})
