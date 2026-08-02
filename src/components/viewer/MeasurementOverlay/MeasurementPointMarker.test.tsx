import * as Cesium from 'cesium'
import { render, fireEvent } from '@testing-library/react'
import { computeBeaconTopPosition } from 'utils/beaconGeometry'
import MeasurementPointMarker from './MeasurementPointMarker'

const CANVAS_RECT = { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => ({}) }

const makeViewer = () => ({
  scene: {
    globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    cartesianToCanvasCoordinates: vi.fn((cartesian: Cesium.Cartesian3) =>
      new Cesium.Cartesian2(Math.round(cartesian.x % 1000), Math.round(cartesian.y % 1000))
    ),
    postRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    screenSpaceCameraController: { enableInputs: true },
    requestRenderMode: true,
    pickPosition: vi.fn(() => undefined),
    drawingBufferWidth: 800,
    drawingBufferHeight: 600,
  },
  camera: {
    getPickRay: vi.fn(() => new Cesium.Ray(Cesium.Cartesian3.ZERO, Cesium.Cartesian3.UNIT_X)),
    pickEllipsoid: vi.fn(() => undefined),
    getPixelSize: vi.fn(() => 1),
  },
  canvas: { getBoundingClientRect: () => CANVAS_RECT },
  terrainProvider: undefined as unknown as Cesium.TerrainProvider,
}) as unknown as Cesium.Viewer

const cartographic = Cesium.Cartographic.fromDegrees(10, 20, 0)

it('renders the beacon line', () => {
  const viewer = makeViewer()
  const { container } = render(
    <MeasurementPointMarker viewer={viewer} cartographic={cartographic} onDragMove={vi.fn()} onDragEnd={vi.fn()} />
  )
  expect(container.querySelector('line')).toBeInTheDocument()
})

describe('dragging', () => {
  it('reports the live drag position and the terrain-picked drop position', () => {
    const viewer = makeViewer()
    const dragPlanePosition = Cesium.Cartesian3.fromDegrees(15, 25, 0)
    const rayPlaneSpy = vi.spyOn(Cesium.IntersectionTests, 'rayPlane').mockReturnValue(dragPlanePosition)

    const terrainPickedPosition = Cesium.Cartesian3.fromDegrees(15.2, 25.3, 50)
    viewer.scene.pickPosition = vi.fn(() => terrainPickedPosition)

    const onDragMove = vi.fn()
    const onDragEnd = vi.fn()
    const { container } = render(
      <MeasurementPointMarker viewer={viewer} cartographic={cartographic} onDragMove={onDragMove} onDragEnd={onDragEnd} />
    )
    const wrapper = container.firstChild as HTMLElement
    const hitTarget = wrapper.firstChild as HTMLElement

    fireEvent.pointerDown(hitTarget, { clientX: 50, clientY: 50 })
    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(false)
    expect(viewer.scene.requestRenderMode).toBe(false)

    fireEvent(window, new PointerEvent('pointermove', { clientX: 60, clientY: 60 }))
    expect(onDragMove).toHaveBeenCalledWith(dragPlanePosition)

    // Both endpoints of the beacon are re-projected live during the drag,
    // using the same geometry helper the production code calls.
    const expectedGroundScreen = viewer.scene.cartesianToCanvasCoordinates(dragPlanePosition)
    const expectedTopCartesian = computeBeaconTopPosition(viewer, dragPlanePosition)
    const expectedTopScreen = viewer.scene.cartesianToCanvasCoordinates(expectedTopCartesian)
    expect(wrapper.style.transform).toBe(`translate(${expectedGroundScreen.x}px, ${expectedGroundScreen.y}px)`)
    const line = container.querySelector('line') as SVGLineElement
    expect(line.getAttribute('x2')).toBe(String(expectedTopScreen.x - expectedGroundScreen.x))
    expect(line.getAttribute('y2')).toBe(String(expectedTopScreen.y - expectedGroundScreen.y))

    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))

    expect(viewer.scene.screenSpaceCameraController.enableInputs).toBe(true)
    expect(viewer.scene.requestRenderMode).toBe(true)
    expect(onDragEnd).toHaveBeenCalledWith(terrainPickedPosition)

    rayPlaneSpy.mockRestore()
  })

  it('falls back to the drag plane position if terrain picking fails at drop time', () => {
    const viewer = makeViewer()
    const dragPlanePosition = Cesium.Cartesian3.fromDegrees(15, 25, 0)
    const rayPlaneSpy = vi.spyOn(Cesium.IntersectionTests, 'rayPlane').mockReturnValue(dragPlanePosition)

    const onDragEnd = vi.fn()
    const { container } = render(
      <MeasurementPointMarker viewer={viewer} cartographic={cartographic} onDragMove={vi.fn()} onDragEnd={onDragEnd} />
    )
    const wrapper = container.firstChild as HTMLElement
    const hitTarget = wrapper.firstChild as HTMLElement

    fireEvent.pointerDown(hitTarget, { clientX: 50, clientY: 50 })
    fireEvent(window, new PointerEvent('pointermove', { clientX: 60, clientY: 60 }))
    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))

    expect(onDragEnd).toHaveBeenCalledWith(dragPlanePosition)

    rayPlaneSpy.mockRestore()
  })

  it('pauses the tracked-position hook while dragging', () => {
    const viewer = makeViewer()
    const addListenerMock = viewer.scene.postRender.addEventListener as ReturnType<typeof vi.fn>
    const removeListenerMock = viewer.scene.postRender.removeEventListener as ReturnType<typeof vi.fn>

    const { container } = render(
      <MeasurementPointMarker viewer={viewer} cartographic={cartographic} onDragMove={vi.fn()} onDragEnd={vi.fn()} />
    )
    const wrapper = container.firstChild as HTMLElement
    const hitTarget = wrapper.firstChild as HTMLElement

    expect(addListenerMock).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(hitTarget, { clientX: 50, clientY: 50 })
    expect(removeListenerMock).toHaveBeenCalledTimes(1)

    fireEvent(window, new PointerEvent('pointerup', { clientX: 60, clientY: 60 }))
    expect(addListenerMock).toHaveBeenCalledTimes(2)
  })
})
