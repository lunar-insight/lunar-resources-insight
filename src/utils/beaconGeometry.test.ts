import * as Cesium from 'cesium'
import { computeBeaconTopPosition, applyBeaconProjection } from './beaconGeometry'

const groundCartesian = Cesium.Cartesian3.fromDegrees(10, 20, 0)

const makeViewer = (metersPerPixel: number) => ({
  scene: {
    globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
  },
  camera: {
    getPixelSize: vi.fn(() => metersPerPixel),
  },
}) as unknown as Cesium.Viewer

describe('computeBeaconTopPosition', () => {
  it('offsets the ground point along the local surface normal', () => {
    const viewer = makeViewer(1)
    const top = computeBeaconTopPosition(viewer, groundCartesian)

    const ellipsoid = Cesium.Ellipsoid.MOON
    const normal = ellipsoid.geodeticSurfaceNormal(groundCartesian, new Cesium.Cartesian3())
    const offset = Cesium.Cartesian3.subtract(top, groundCartesian, new Cesium.Cartesian3())
    const offsetLength = Cesium.Cartesian3.magnitude(offset)
    const offsetDirection = Cesium.Cartesian3.normalize(offset, new Cesium.Cartesian3())

    // 1 meter per pixel * 32 target pixels, within the min/max clamp.
    expect(offsetLength).toBeCloseTo(32, 5)
    expect(Cesium.Cartesian3.dot(offsetDirection, normal)).toBeCloseTo(1, 10)
  })

  it('clamps the offset to a minimum distance when very close to the camera', () => {
    const viewer = makeViewer(0.001)
    const top = computeBeaconTopPosition(viewer, groundCartesian)
    const offsetLength = Cesium.Cartesian3.distance(top, groundCartesian)
    expect(offsetLength).toBeCloseTo(2, 5)
  })

  it('clamps the offset to a maximum distance when very far from the camera', () => {
    const viewer = makeViewer(1_000_000)
    const top = computeBeaconTopPosition(viewer, groundCartesian)
    const offsetLength = Cesium.Cartesian3.distance(top, groundCartesian)
    expect(offsetLength).toBeCloseTo(50000, 5)
  })
})

describe('applyBeaconProjection', () => {
  const makeElements = () => {
    const wrapper = document.createElement('div')
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line') as SVGLineElement
    return { wrapper, line }
  }

  it('positions the wrapper and points the line at the top screen position', () => {
    const { wrapper, line } = makeElements()
    applyBeaconProjection(wrapper, line, new Cesium.Cartesian2(100, 200), new Cesium.Cartesian2(110, 170))

    expect(wrapper.style.display).toBe('')
    expect(wrapper.style.transform).toBe('translate(100px, 200px)')
    expect(line.getAttribute('x2')).toBe('10')
    expect(line.getAttribute('y2')).toBe('-30')
  })

  it('hides the wrapper when the ground point does not project', () => {
    const { wrapper, line } = makeElements()
    applyBeaconProjection(wrapper, line, undefined, new Cesium.Cartesian2(110, 170))
    expect(wrapper.style.display).toBe('none')
  })

  it('collapses the line to a point when only the top point fails to project', () => {
    const { wrapper, line } = makeElements()
    applyBeaconProjection(wrapper, line, new Cesium.Cartesian2(100, 200), undefined)

    expect(wrapper.style.display).toBe('')
    expect(line.getAttribute('x2')).toBe('0')
    expect(line.getAttribute('y2')).toBe('0')
  })
})
