import * as Cesium from 'cesium'

const {
  pointMarkerSpy,
  distanceLabelSpy,
  hoverMarkerSpy,
  serviceInstances,
  computeSurfaceDistanceMock,
  computeTerrainDistanceMock,
} = vi.hoisted(() => ({
  pointMarkerSpy: vi.fn((_props: any) => null),
  distanceLabelSpy: vi.fn((_props: any) => null),
  hoverMarkerSpy: vi.fn((_props: any) => null),
  serviceInstances: [] as any[],
  computeSurfaceDistanceMock: vi.fn((_a: any, _b: any) => 42),
  computeTerrainDistanceMock: vi.fn((_a: any, _b: any) => Promise.resolve(99)),
}))

vi.mock('./MeasurementPointMarker', () => ({ default: pointMarkerSpy }))
vi.mock('./MeasurementDistanceLabel', () => ({ default: distanceLabelSpy }))
vi.mock('./MeasurementHoverMarker', () => ({ default: hoverMarkerSpy }))

vi.mock('services/MeasurementLineService', () => {
  class MockMeasurementLineService {
    setViewer = vi.fn()
    setCallbacks = vi.fn()
    start = vi.fn()
    stop = vi.fn()
    setDistanceMode = vi.fn()
    previewDrag = vi.fn()
    commitDrag = vi.fn()
    destroy = vi.fn()
    constructor() {
      serviceInstances.push(this)
    }
  }
  return { MeasurementLineService: MockMeasurementLineService }
})

vi.mock('utils/measurementDistance', () => ({
  computeSurfaceDistance: computeSurfaceDistanceMock,
  computeTerrainDistance: computeTerrainDistanceMock,
}))

vi.mock('utils/context/ViewerContext', () => ({ useViewer: vi.fn() }))
vi.mock('utils/context/MeasurementContext', () => ({ useMeasurementContext: vi.fn() }))

import { render } from '@testing-library/react'
import { useViewer } from 'utils/context/ViewerContext'
import { useMeasurementContext } from 'utils/context/MeasurementContext'
import MeasurementOverlay from './MeasurementOverlay'

const pointA = Cesium.Cartographic.fromDegrees(10, 20, 0)
const pointB = Cesium.Cartographic.fromDegrees(11, 21, 0)

const makeViewer = () =>
  ({
    scene: {
      cartesianToCanvasCoordinates: vi.fn(() => new Cesium.Cartesian2(10, 20)),
    },
  }) as unknown as Cesium.Viewer

function makeMeasurementContext(overrides: Record<string, unknown> = {}) {
  return {
    isActive: true,
    points: [] as Cesium.Cartographic[],
    setPoints: vi.fn(),
    distanceMode: 'surface',
    setDistanceMode: vi.fn(),
    distanceMeters: null,
    setDistanceMeters: vi.fn(),
    isDistanceLoading: false,
    setIsDistanceLoading: vi.fn(),
    ...overrides,
  } as any
}

const currentService = () => serviceInstances[serviceInstances.length - 1]

beforeEach(() => {
  serviceInstances.length = 0
  pointMarkerSpy.mockClear()
  distanceLabelSpy.mockClear()
  hoverMarkerSpy.mockClear()
  computeSurfaceDistanceMock.mockClear()
  computeTerrainDistanceMock.mockClear()
  computeSurfaceDistanceMock.mockImplementation(() => 42)
  computeTerrainDistanceMock.mockImplementation(() => Promise.resolve(99))
  vi.mocked(useViewer).mockReturnValue({ viewer: makeViewer(), setViewer: vi.fn() })
  vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext())
})

describe('no viewer', () => {
  it('renders nothing', () => {
    vi.mocked(useViewer).mockReturnValue({ viewer: null, setViewer: vi.fn() })
    const { container } = render(<MeasurementOverlay />)
    expect(container.firstChild).toBeNull()
  })
})

describe('service wiring', () => {
  it('passes the viewer and three callbacks to the service', () => {
    const viewer = makeViewer()
    vi.mocked(useViewer).mockReturnValue({ viewer, setViewer: vi.fn() })

    render(<MeasurementOverlay />)

    const service = currentService()
    expect(service.setViewer).toHaveBeenCalledWith(viewer)
    expect(service.setCallbacks).toHaveBeenCalledTimes(1)
    const [onPointsCommitted, onLiveDistance, onHoverPosition] = service.setCallbacks.mock.calls[0]
    expect(onPointsCommitted).toBeInstanceOf(Function)
    expect(onLiveDistance).toBeInstanceOf(Function)
    expect(onHoverPosition).toBeInstanceOf(Function)
  })

  it('forwards committed points from the service into context', () => {
    const setPoints = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ setPoints }))

    render(<MeasurementOverlay />)

    const [onPointsCommitted] = currentService().setCallbacks.mock.calls[0]
    onPointsCommitted([pointA])
    expect(setPoints).toHaveBeenCalledWith([pointA])
  })

  it('forwards live distance updates from the service into context', () => {
    const setDistanceMeters = vi.fn()
    const setIsDistanceLoading = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(
      makeMeasurementContext({ setDistanceMeters, setIsDistanceLoading })
    )

    render(<MeasurementOverlay />)

    const [, onLiveDistance] = currentService().setCallbacks.mock.calls[0]
    onLiveDistance(123)
    expect(setDistanceMeters).toHaveBeenCalledWith(123)
    expect(setIsDistanceLoading).toHaveBeenCalledWith(false)
  })

  it('does not throw when the hover callback fires before the marker has mounted', () => {
    render(<MeasurementOverlay />)
    const [, , onHoverPosition] = currentService().setCallbacks.mock.calls[0]
    expect(() => onHoverPosition(Cesium.Cartesian3.fromDegrees(10, 20, 0))).not.toThrow()
  })

  it('starts the service when the tool is active', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ isActive: true }))
    render(<MeasurementOverlay />)
    expect(currentService().start).toHaveBeenCalledTimes(1)
    expect(currentService().stop).not.toHaveBeenCalled()
  })

  it('stops the service when the tool is inactive', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ isActive: false }))
    render(<MeasurementOverlay />)
    expect(currentService().stop).toHaveBeenCalledTimes(1)
    expect(currentService().start).not.toHaveBeenCalled()
  })

  it('syncs the distance mode to the service', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ distanceMode: 'terrain' }))
    render(<MeasurementOverlay />)
    expect(currentService().setDistanceMode).toHaveBeenCalledWith('terrain')
  })

  it('destroys the service on unmount', () => {
    const { unmount } = render(<MeasurementOverlay />)
    const service = currentService()
    unmount()
    expect(service.destroy).toHaveBeenCalledTimes(1)
  })
})

describe('markers', () => {
  it('renders one marker per committed point', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ points: [pointA, pointB] }))
    render(<MeasurementOverlay />)

    expect(pointMarkerSpy).toHaveBeenCalledTimes(2)
    expect(pointMarkerSpy.mock.calls[0][0].cartographic).toBe(pointA)
    expect(pointMarkerSpy.mock.calls[1][0].cartographic).toBe(pointB)
  })

  it('wires each marker drag callback to the service by its index', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ points: [pointA, pointB] }))
    render(<MeasurementOverlay />)

    const service = currentService()
    const liveCartesian = Cesium.Cartesian3.fromDegrees(12, 22, 0)

    pointMarkerSpy.mock.calls[0][0].onDragMove(liveCartesian)
    expect(service.previewDrag).toHaveBeenCalledWith(0, liveCartesian)

    pointMarkerSpy.mock.calls[1][0].onDragEnd(liveCartesian)
    expect(service.commitDrag).toHaveBeenCalledWith(1, liveCartesian)
  })
})

describe('distance label', () => {
  it('is not rendered with fewer than two points', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(makeMeasurementContext({ points: [pointA] }))
    render(<MeasurementOverlay />)
    expect(distanceLabelSpy).not.toHaveBeenCalled()
  })

  it('renders at the geodesic midpoint with the current distance and loading state', () => {
    vi.mocked(useMeasurementContext).mockReturnValue(
      makeMeasurementContext({ points: [pointA, pointB], distanceMeters: 1234, isDistanceLoading: true })
    )
    render(<MeasurementOverlay />)

    expect(distanceLabelSpy).toHaveBeenCalledTimes(1)
    const props = distanceLabelSpy.mock.calls[0][0]
    const expectedMidpoint = new Cesium.EllipsoidGeodesic(pointA, pointB).interpolateUsingFraction(0.5)
    expect(props.cartographic.longitude).toBeCloseTo(expectedMidpoint.longitude)
    expect(props.cartographic.latitude).toBeCloseTo(expectedMidpoint.latitude)
    expect(props.distanceMeters).toBe(1234)
    expect(props.isLoading).toBe(true)
  })
})

describe('distance recompute effect', () => {
  it('resets distance to null with fewer than two points', () => {
    const setDistanceMeters = vi.fn()
    const setIsDistanceLoading = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(
      makeMeasurementContext({ points: [], setDistanceMeters, setIsDistanceLoading })
    )

    render(<MeasurementOverlay />)

    expect(setDistanceMeters).toHaveBeenCalledWith(null)
    expect(setIsDistanceLoading).toHaveBeenCalledWith(false)
    expect(computeSurfaceDistanceMock).not.toHaveBeenCalled()
    expect(computeTerrainDistanceMock).not.toHaveBeenCalled()
  })

  it('computes surface distance synchronously in surface mode', () => {
    const setDistanceMeters = vi.fn()
    const setIsDistanceLoading = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(
      makeMeasurementContext({
        points: [pointA, pointB],
        distanceMode: 'surface',
        setDistanceMeters,
        setIsDistanceLoading,
      })
    )

    render(<MeasurementOverlay />)

    expect(computeSurfaceDistanceMock).toHaveBeenCalledWith(pointA, pointB)
    expect(setDistanceMeters).toHaveBeenCalledWith(42)
    expect(setIsDistanceLoading).toHaveBeenCalledWith(false)
    expect(computeTerrainDistanceMock).not.toHaveBeenCalled()
  })

  it('computes terrain distance asynchronously in terrain mode, toggling isDistanceLoading', async () => {
    let resolveTerrain!: (meters: number) => void
    computeTerrainDistanceMock.mockImplementationOnce(
      () => new Promise<number>((resolve) => { resolveTerrain = resolve })
    )
    const setDistanceMeters = vi.fn()
    const setIsDistanceLoading = vi.fn()
    vi.mocked(useMeasurementContext).mockReturnValue(
      makeMeasurementContext({
        points: [pointA, pointB],
        distanceMode: 'terrain',
        setDistanceMeters,
        setIsDistanceLoading,
      })
    )

    render(<MeasurementOverlay />)

    expect(computeTerrainDistanceMock).toHaveBeenCalledWith(pointA, pointB)
    expect(setIsDistanceLoading).toHaveBeenCalledWith(true)
    expect(setDistanceMeters).not.toHaveBeenCalled()

    resolveTerrain(555)
    await Promise.resolve()
    await Promise.resolve()

    expect(setDistanceMeters).toHaveBeenCalledWith(555)
    expect(setIsDistanceLoading).toHaveBeenCalledWith(false)
  })
})
