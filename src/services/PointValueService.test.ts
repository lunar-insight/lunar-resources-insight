vi.mock('../geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      layer_a: { filename: 'a.tif', category: 'chemical', element: 'iron', units: 'wt%' },
    },
  },
  getPointValueUrl: vi.fn(() => 'http://example.test/point'),
  fetchCogInfo: vi.fn(),
}))

vi.mock('./LayerStatsService', () => ({
  layerStatsService: {
    getLayersByElement: vi.fn(() => []),
    refreshStats: vi.fn(),
  },
}))

vi.mock('../components/viewer/ScanIndicator/ScanIndicator', () => ({
  ScanIndicator: vi.fn(function (this: any) {
    this.setViewer = vi.fn();
    this.hide = vi.fn();
    this.updatePosition = vi.fn();
    this.destroy = vi.fn();
  }),
}))

vi.mock('cesium', () => ({
  Math: { toDegrees: (rad: number) => rad },
}))

import { PointValueService, type PointValueCallbackData } from './PointValueService'

function makeFakeViewer() {
  return {
    scene: {
      globe: {
        ellipsoid: {
          cartesianToCartographic: () => ({ longitude: 1, latitude: 2 }),
        },
      },
    },
    camera: {
      pickEllipsoid: () => ({ x: 1, y: 2, z: 3 }),
    },
  }
}

function resolvedFetch(values: number[]) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ values }),
  })
}

// The service exposes disable/enable and the values-update subscription
// publicly; fetchPointValues/viewer/currentMousePosition/selectedLayers are
// private implementation details reached here through an `any` cast so the
// race can be reproduced without standing up Cesium's full mouse-move
// event pipeline.

describe('PointValueService: throttle trailing edge', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fetches the latest position once a slow in-flight request completes', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.explicitlySelectedLayers = ['layer_a']
    service.selectedLayers = ['layer_a']

    let resolveFirst: (value: unknown) => void = () => {}
    const first = new Promise(resolve => { resolveFirst = resolve })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValue(resolvedFetch([2.2]))
    vi.stubGlobal('fetch', fetchMock)

    // The cursor passes over position A and a slow request goes out for it.
    service.currentMousePosition = { x: 10, y: 10 }
    service.throttledFetchPointValues()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // The cursor moves to position B and stops there. The throttle timer fires
    // while the position A request is still in flight.
    vi.advanceTimersByTime(50)
    service.currentMousePosition = { x: 20, y: 20 }
    service.throttledFetchPointValues()
    vi.advanceTimersByTime(100)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Position B must still be fetched when the slow request resolves, without
    // waiting for another mouse-move event.
    resolveFirst(resolvedFetch([7.6]))
    await vi.advanceTimersByTimeAsync(200)

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('stops issuing requests once the cursor is stationary', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.explicitlySelectedLayers = ['layer_a']
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => resolvedFetch([7.6]))
    vi.stubGlobal('fetch', fetchMock)

    service.currentMousePosition = { x: 10, y: 10 }
    service.throttledFetchPointValues()
    vi.advanceTimersByTime(10)
    service.currentMousePosition = { x: 20, y: 20 }
    service.throttledFetchPointValues()

    // The cursor is stationary from here on, so the trailing fetch must be the
    // last one: two batches total, with no further requests afterwards.
    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not fetch a trailing position after tracking is disabled', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.explicitlySelectedLayers = ['layer_a']
    service.selectedLayers = ['layer_a']

    let resolveFirst: (value: unknown) => void = () => {}
    const first = new Promise(resolve => { resolveFirst = resolve })
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValue(resolvedFetch([2.2]))
    vi.stubGlobal('fetch', fetchMock)

    service.currentMousePosition = { x: 10, y: 10 }
    service.throttledFetchPointValues()

    vi.advanceTimersByTime(50)
    service.currentMousePosition = { x: 20, y: 20 }
    service.throttledFetchPointValues()

    service.disableMouseTracking()

    resolveFirst(resolvedFetch([7.6]))
    await vi.advanceTimersByTimeAsync(200)

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('PointValueService: pausing while a fetch is in flight', () => {
  it('does not let a stale successful fetch overwrite the paused notification', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.explicitlySelectedLayers = ['layer_a']
    service.selectedLayers = ['layer_a']

    let resolveFetch: (value: unknown) => void = () => {}
    const pendingFetch = new Promise(resolve => { resolveFetch = resolve })
    vi.stubGlobal('fetch', vi.fn(() => pendingFetch))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    const fetchCall = service.fetchPointValues()

    // Mirrors DraggableBoxContentContainer's hover behavior: synchronously
    // notifies isPaused=true while the request above is still in flight.
    service.disableMouseTracking()

    resolveFetch(resolvedFetch([7.6]))
    await fetchCall

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({ displayValues: {}, allValues: {}, isPaused: true })
  })

  it('still notifies normally when tracking stays enabled for the whole fetch', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.explicitlySelectedLayers = ['layer_a']
    service.selectedLayers = ['layer_a']

    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([7.6])))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      displayValues: { layer_a: 7.6 },
      allValues: { layer_a: 7.6 },
      isPaused: false,
    })
  })
})
