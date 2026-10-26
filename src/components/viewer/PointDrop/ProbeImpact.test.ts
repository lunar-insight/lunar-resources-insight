import * as Cesium from 'cesium'
import { IMPACT_EFFECTS, ProbeImpact, REDUCED_EFFECTS } from './ProbeImpact'

// Cesium's Material tells uniform types apart with image types jsdom lacks.
vi.stubGlobal('ImageBitmap', class {})
vi.stubGlobal('OffscreenCanvas', class {})

const METERS_PER_PIXEL = 10
const position = Cesium.Cartesian3.fromDegrees(10, 20, 0, Cesium.Ellipsoid.MOON)

function fakeViewer(clientWidth = 800, clientHeight = 600) {
  return {
    scene: {
      groundPrimitives: { add: vi.fn(<T,>(primitive: T) => primitive), remove: vi.fn() },
      preRender: new Cesium.Event(),
      postRender: new Cesium.Event(),
      requestRender: vi.fn(),
      canvas: { clientWidth, clientHeight },
      globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    },
    camera: {
      getPixelSize: vi.fn(() => METERS_PER_PIXEL),
      pickEllipsoid: vi.fn((): Cesium.Cartesian3 | undefined => position),
    },
  }
}

type Viewer = ReturnType<typeof fakeViewer>
const asViewer = (viewer: Viewer) => viewer as unknown as Cesium.CesiumWidget
const added = (viewer: Viewer) => viewer.scene.groundPrimitives.add.mock.calls.map(([primitive]) => primitive as Cesium.GroundPrimitive)
const discRadius = (primitive: Cesium.GroundPrimitive) =>
  ((primitive.geometryInstances as Cesium.GeometryInstance).geometry as unknown as { _semiMajorAxis: number })._semiMajorAxis
const uniforms = (primitive: Cesium.GroundPrimitive) => (primitive.appearance as Cesium.MaterialAppearance).material.uniforms

// The impact's disc reaches the first ring's edge plus its 8 px halo.
const DISC_PX = 60 + 8

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout'] })
})
afterEach(() => { vi.useRealTimers() })

describe('the impact', () => {
  it('lays one disc on the ground, sized in screen pixels and left out of picking', () => {
    const viewer = fakeViewer()
    new ProbeImpact(asViewer(viewer), position, false)

    const [disc] = added(viewer)
    expect(disc).toBeInstanceOf(Cesium.GroundPrimitive)
    expect(discRadius(disc)).toBeCloseTo(DISC_PX * METERS_PER_PIXEL)
    expect(disc.allowPicking).toBe(false)
  })

  it('starts the rings small and transparent, with the glow at 40%', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, false)
    const start = impact.uniformsAt(0, METERS_PER_PIXEL)

    // The first ring's line sits 1 px inside its 60 px edge, at 4% of its size.
    expect(start.radii.x).toBeCloseTo((0.04 * 59) / DISC_PX)
    expect(start.widths.x).toBeCloseTo((0.04 * 2) / DISC_PX)
    expect(start.alphas).toEqual(new Cesium.Cartesian3(0, 0, 0))
    expect(start.glow.x).toBeCloseTo((0.4 * 35) / DISC_PX)
    expect(start.glow.y).toBe(0)
    expect(start.pixel).toBeCloseTo(1 / DISC_PX)
  })

  it('spreads and fades the rings in turn', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, false)

    const early = impact.uniformsAt(100, METERS_PER_PIXEL)
    expect(early.alphas.x).toBeGreaterThan(0.5)
    expect(early.alphas.y).toBe(0)
    expect(early.glow.y).toBeGreaterThan(0)

    const end = impact.uniformsAt(950, METERS_PER_PIXEL)
    expect(end.radii.x).toBeCloseTo(59 / DISC_PX)
    expect(end.alphas.x).toBeCloseTo(0)
    expect(end.alphas.y).toBeGreaterThan(0)
  })

  it('keeps its size on screen while the camera moves', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, false)
    // Twice as close, the disc covers twice the pixels, so the rings take half of it.
    const near = impact.uniformsAt(950, METERS_PER_PIXEL / 2)
    expect(near.radii.x).toBeCloseTo(59 / DISC_PX / 2)
    expect(near.pixel).toBeCloseTo(1 / DISC_PX / 2)
  })

  it('sets the uniforms before every frame is drawn', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, false)
    const [disc] = added(viewer)

    vi.advanceTimersByTime(100)
    viewer.scene.preRender.raiseEvent()
    expect(uniforms(disc).alphas).toEqual(impact.uniformsAt(100, METERS_PER_PIXEL).alphas)
    expect(viewer.camera.getPixelSize).toHaveBeenLastCalledWith(expect.any(Cesium.BoundingSphere), 800, 600)
  })

  it('renders every frame and removes itself once played', () => {
    const viewer = fakeViewer()
    new ProbeImpact(asViewer(viewer), position, false)
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(500)
    expect(viewer.scene.requestRender.mock.calls.length).toBeGreaterThan(10)
    expect(viewer.scene.groundPrimitives.remove).not.toHaveBeenCalled()

    vi.advanceTimersByTime(700)
    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalledWith(added(viewer)[0])
    expect(viewer.scene.preRender.numberOfListeners).toBe(0)
  })

  it('can be removed early, once', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, false)
    impact.destroy()
    impact.destroy()
    expect(viewer.scene.groundPrimitives.remove).toHaveBeenCalledTimes(1)

    const renders = viewer.scene.requestRender.mock.calls.length
    vi.advanceTimersByTime(500)
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(renders)
  })

  it('measures a canvas without size as one pixel', () => {
    const viewer = fakeViewer(0, 0)
    new ProbeImpact(asViewer(viewer), position, false)
    expect(viewer.camera.getPixelSize).toHaveBeenCalledWith(expect.any(Cesium.BoundingSphere), 1, 1)
  })

  it('plays a glow and three rings', () => {
    expect(IMPACT_EFFECTS.map(effect => effect.kind)).toEqual(['glow', 'ring', 'ring', 'ring'])
  })
})

describe('the impact with reduced motion', () => {
  it('shows one ring at a fixed size, fading in and out', () => {
    const viewer = fakeViewer()
    const impact = new ProbeImpact(asViewer(viewer), position, true)
    const disc = 22 + 8
    expect(REDUCED_EFFECTS).toHaveLength(1)
    expect(discRadius(added(viewer)[0])).toBeCloseTo(disc * METERS_PER_PIXEL)

    const start = impact.uniformsAt(0, METERS_PER_PIXEL)
    const peak = impact.uniformsAt(225, METERS_PER_PIXEL)
    const end = impact.uniformsAt(900, METERS_PER_PIXEL)
    expect(start.radii.x).toBeCloseTo(21 / disc)
    expect(peak.radii.x).toBeCloseTo(21 / disc)
    expect(start.alphas.x).toBe(0)
    expect(peak.alphas.x).toBeGreaterThan(0.3)
    expect(end.alphas.x).toBeCloseTo(0)
    expect(peak.glow.y).toBe(0)
    expect(peak.alphas.y).toBe(0)
  })
})

describe('keeping the shaders compiled', () => {
  it('keeps two discs with the impact shader in the scene', () => {
    const viewer = fakeViewer()
    ProbeImpact.keepShadersCompiled(asViewer(viewer))
    const discs = added(viewer)
    expect(discs.map(discRadius)).toEqual([1_000, 300_000])
    expect(uniforms(discs[0]).alphas).toEqual(new Cesium.Cartesian3(0, 0, 0))
  })
})
