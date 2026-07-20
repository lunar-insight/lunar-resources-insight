import * as Cesium from 'cesium'

const updateFeaturePositionMock = vi.fn()
let mockContextValue: Record<string, unknown> = {}

vi.mock('utils/context/FeaturesContext', () => ({
  useFeaturesContext: () => mockContextValue,
}))

import { render, screen, fireEvent } from '@testing-library/react'
import { Feature } from '../types'
import FeaturePointMarker from './FeaturePointMarker'

const CANVAS_RECT = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) }

const makeViewer = () => ({
  scene: {
    globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    // A deterministic function of the input, not a constant, so tests can
    // distinguish the screen position for the original spot from the screen
    // position for wherever the live drag currently is.
    cartesianToCanvasCoordinates: vi.fn((cartesian: Cesium.Cartesian3) =>
      new Cesium.Cartesian2(Math.round(cartesian.x % 1000), Math.round(cartesian.y % 1000))
    ),
    postRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    screenSpaceCameraController: { enableInputs: true },
    requestRenderMode: true,
    // No terrain-picked result by default; individual tests override this
    // to supply the drop-time terrain pick.
    pickPosition: vi.fn(() => undefined),
  },
  camera: {
    getPickRay: vi.fn(() => new Cesium.Ray(Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_X)),
    pickEllipsoid: vi.fn(() => undefined),
  },
  canvas: { getBoundingClientRect: () => CANVAS_RECT },
  terrainProvider: undefined as unknown as Cesium.TerrainProvider,
}) as unknown as Cesium.Viewer

const makeFeature = (overrides: Partial<Feature> = {}): Feature => ({
  id: 'point-1',
  type: 'point',
  name: 'Test Point',
  entity: {} as Cesium.Entity,
  color: '#00FFFFFF',
  metadata: {
    position: Cesium.Cartographic.fromDegrees(10, 20, 0),
    createdAt: new Date(),
  },
  insightsOpen: false,
  visible: true,
  ...overrides,
})

beforeEach(() => {
  updateFeaturePositionMock.mockClear()
  mockContextValue = {
    activeDrawingTool: null,
    showFeatures: true,
    showLabels: true,
    updateFeaturePosition: updateFeaturePositionMock,
  }
})

it('renders the dot and label for a visible feature', () => {
  const viewer = makeViewer()
  render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)

  expect(screen.getByText('Test Point')).toBeInTheDocument()
})

it('hides the dot and label when the feature is not visible', () => {
  const viewer = makeViewer()
  render(<FeaturePointMarker viewer={viewer} feature={makeFeature({ visible: false })} />)

  expect(screen.queryByText('Test Point')).not.toBeInTheDocument()
})

it('hides the label but keeps the dot when showLabels is off', () => {
  mockContextValue = { ...mockContextValue, showLabels: false }
  const viewer = makeViewer()
  const { container } = render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)

  expect(screen.queryByText('Test Point')).not.toBeInTheDocument()
  expect(container.querySelector('span')).toBeInTheDocument()
})

it('renders nothing when the feature has no position', () => {
  const viewer = makeViewer()
  const { container } = render(
    <FeaturePointMarker viewer={viewer} feature={makeFeature({ metadata: { createdAt: new Date() } })} />
  )

  expect(container.firstChild).toBeNull()
})

describe('dragging', () => {
  it('follows the drag plane approximation live, but resolves the drop with terrain-accurate picking', () => {
    const viewer = makeViewer()
    const dragPlanePosition = Cesium.Cartesian3.fromDegrees(15, 25, 0)
    const rayPlaneSpy = vi.spyOn(Cesium.IntersectionTests, 'rayPlane').mockReturnValue(dragPlanePosition)

    // The plane approximation used for live feedback is only tangent at the
    // drag's start position. On sloped terrain, the accurate pick at drop
    // time can differ from it in both lon/lat and height.
    const terrainPickedPosition = Cesium.Cartesian3.fromDegrees(15.2, 25.3, 50)
    viewer.scene.pickPosition = vi.fn(() => terrainPickedPosition)

    const { container } = render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)
    const marker = container.firstChild as HTMLElement

    fireEvent.pointerDown(marker, { clientX: 50, clientY: 50 })
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(false)
    // Rendering must be continuous during the drag: requestRenderMode
    // otherwise only re-renders on camera changes, none of which a
    // stationary-camera drag triggers, leaving the picking/projection math
    // stale.
    expect(viewer.scene.requestRenderMode).toBe(false)

    fireEvent(window, new PointerEvent('pointermove', { clientX: 60, clientY: 60 }))

    // The marker follows the drag live via the plane approximation, not
    // just on drop.
    const expectedScreen = viewer.scene.cartesianToCanvasCoordinates(dragPlanePosition)
    expect(marker.style.transform).toBe(`translate(${expectedScreen.x}px, ${expectedScreen.y}px) translate(-50%, -50%)`)

    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))

    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true)
    expect(viewer.scene.requestRenderMode).toBe(true)
    expect(viewer.scene.pickPosition).toHaveBeenCalled()
    expect(updateFeaturePositionMock).toHaveBeenCalledTimes(1)

    // The stored position comes from the terrain pick, not the drag plane.
    const [id, cartographic] = updateFeaturePositionMock.mock.calls[0]
    expect(id).toBe('point-1')
    const expected = Cesium.Ellipsoid.MOON.cartesianToCartographic(terrainPickedPosition)
    expect(cartographic.longitude).toBeCloseTo(expected.longitude)
    expect(cartographic.latitude).toBeCloseTo(expected.latitude)
    expect(cartographic.height).toBeCloseTo(expected.height)

    rayPlaneSpy.mockRestore()
  })

  it('falls back to the drag plane position if terrain picking fails at drop time', () => {
    const viewer = makeViewer()
    const dragPlanePosition = Cesium.Cartesian3.fromDegrees(15, 25, 0)
    const rayPlaneSpy = vi.spyOn(Cesium.IntersectionTests, 'rayPlane').mockReturnValue(dragPlanePosition)
    // scene.pickPosition and camera.pickEllipsoid both default to undefined.

    const { container } = render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)
    const marker = container.firstChild as HTMLElement

    fireEvent.pointerDown(marker, { clientX: 50, clientY: 50 })
    fireEvent(window, new PointerEvent('pointermove', { clientX: 60, clientY: 60 }))
    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))

    expect(updateFeaturePositionMock).toHaveBeenCalledTimes(1)
    const [, cartographic] = updateFeaturePositionMock.mock.calls[0]
    const expected = Cesium.Ellipsoid.MOON.cartesianToCartographic(dragPlanePosition)
    expect(cartographic.longitude).toBeCloseTo(expected.longitude)
    expect(cartographic.latitude).toBeCloseTo(expected.latitude)

    rayPlaneSpy.mockRestore()
  })

  it('pauses the tracked-position hook while dragging, so it cannot fight the live drag update', () => {
    const viewer = makeViewer()
    const addListenerMock = viewer.scene.postRender.addEventListener as ReturnType<typeof vi.fn>
    const removeListenerMock = viewer.scene.postRender.removeEventListener as ReturnType<typeof vi.fn>

    const { container } = render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)
    const marker = container.firstChild as HTMLElement

    expect(addListenerMock).toHaveBeenCalledTimes(1)
    expect(removeListenerMock).not.toHaveBeenCalled()

    fireEvent.pointerDown(marker, { clientX: 50, clientY: 50 })

    // Continuous rendering is on during the drag (see the other test), so
    // this listener must be unsubscribed here; otherwise the hook's own
    // per-frame update would run on every frame too and keep resetting the
    // marker back to its pre-drag position.
    expect(removeListenerMock).toHaveBeenCalledTimes(1)

    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))

    // Dropping re-enables it against the (now updated) position.
    expect(addListenerMock).toHaveBeenCalledTimes(2)
  })

  it('does not start a drag while a drawing tool is active', () => {
    mockContextValue = { ...mockContextValue, activeDrawingTool: 'polygon' }
    const viewer = makeViewer()

    const { container } = render(<FeaturePointMarker viewer={viewer} feature={makeFeature()} />)
    const marker = container.firstChild as HTMLElement

    fireEvent.pointerDown(marker, { clientX: 50, clientY: 50 })

    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true)
  })
})
