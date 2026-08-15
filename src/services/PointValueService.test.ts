vi.mock('../geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      layer_a: { filename: 'a.tif', category: 'chemical', element: 'iron', units: 'wt%' },
    },
  },
  getPointValueUrl: vi.fn(() => 'http://example.test/point'),
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
          // Screen position carries through to coordinates so distinct cursor
          // positions resolve to distinct points, which the service's
          // same-point dedupe depends on. Cesium.Math.toDegrees is mocked as
          // identity, so lon/lat come out as the screen x/y.
          cartesianToCartographic: (cartesian: { x: number; y: number }) => ({
            longitude: cartesian.x,
            latitude: cartesian.y,
          }),
        },
      },
    },
    camera: {
      pickEllipsoid: (position: { x: number; y: number }) => ({
        x: position.x,
        y: position.y,
        z: 0,
      }),
    },
  }
}

function resolvedFetch(values: number[]) {
  return Promise.resolve({
    ok: true,
    json: async () => ({ values }),
  })
}

function failedFetch(status: number) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Bad Gateway',
    json: async () => ({}),
  })
}

// The service exposes disable/enable and the values-update subscription
// publicly; fetchPointValues/viewer/currentMousePosition/selectedLayers are
// private implementation details reached here through an `any` cast so the
// race can be reproduced without standing up Cesium's full mouse-move
// event pipeline.

describe('PointValueService: superseding an in-flight batch', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('fetches the latest position without waiting for the in-flight request', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
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

    // The cursor moves to position B and stops. Once the throttle interval
    // elapses, position B is requested even though position A never resolved.
    vi.advanceTimersByTime(50)
    service.currentMousePosition = { x: 20, y: 20 }
    service.throttledFetchPointValues()
    await vi.advanceTimersByTimeAsync(100)
    expect(fetchMock).toHaveBeenCalledTimes(2)

    // The superseded request resolving afterwards adds no further requests.
    resolveFirst(resolvedFetch([7.6]))
    await vi.advanceTimersByTimeAsync(500)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a superseded batch instead of reporting its layers unavailable', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.selectedLayers = ['layer_a']

    // The superseded request rejects on abort, the way a real fetch does.
    const abortingFetch = (_url: string, init?: { signal?: AbortSignal }) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('AbortError')))
      })
    const fetchMock = vi.fn()
      .mockImplementationOnce(abortingFetch)
      .mockReturnValue(resolvedFetch([2.2]))
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    service.currentMousePosition = { x: 10, y: 10 }
    service.throttledFetchPointValues()

    vi.advanceTimersByTime(50)
    service.currentMousePosition = { x: 20, y: 20 }
    service.throttledFetchPointValues()
    await vi.advanceTimersByTimeAsync(500)

    // Only the surviving batch reports, and the aborted layer is not listed as
    // unavailable, which would render as a failed reading.
    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      values: { layer_a: 2.2 },
      unavailableLayerIds: [],
      isPaused: false,
    })
  })

  it('stops issuing requests once the cursor is stationary', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
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
    expect(updates[0]).toEqual({ values: {}, unavailableLayerIds: [], isPaused: true })
  })

  it('still notifies normally when tracking stays enabled for the whole fetch', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([7.6])))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      values: { layer_a: 7.6 },
      unavailableLayerIds: [],
      isPaused: false,
    })
  })
})

describe('PointValueService: failure is distinct from no data', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('reports a layer as unavailable when its request keeps failing', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    vi.stubGlobal('fetch', vi.fn(() => failedFetch(502)))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    const fetchCall = service.fetchPointValues()
    await vi.advanceTimersByTimeAsync(1000)
    await fetchCall

    expect(updates).toHaveLength(1)
    expect(updates[0]).toEqual({
      values: {},
      unavailableLayerIds: ['layer_a'],
      isPaused: false,
    })
  })

  it('reports no data rather than unavailable when the tiler answers 404', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => failedFetch(404))
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates[0]).toEqual({ values: {}, unavailableLayerIds: [], isPaused: false })
    // A point outside the raster is a definitive answer, so it is not retried.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a failing request once and reports the value when the retry succeeds', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn()
      .mockReturnValueOnce(failedFetch(502))
      .mockReturnValue(resolvedFetch([7.6]))
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    const fetchCall = service.fetchPointValues()
    await vi.advanceTimersByTimeAsync(1000)
    await fetchCall

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(updates[0]).toEqual({
      values: { layer_a: 7.6 },
      unavailableLayerIds: [],
      isPaused: false,
    })
  })
})

describe('PointValueService: same-point dedupe', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('does not refetch a point already sampled', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => resolvedFetch([7.6]))
    vi.stubGlobal('fetch', fetchMock)

    service.currentMousePosition = { x: 10, y: 10 }
    await service.fetchPointValues()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await service.fetchPointValues()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    service.currentMousePosition = { x: 11, y: 10 }
    await service.fetchPointValues()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resamples a point whose previous batch had a failure', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => failedFetch(502))
    vi.stubGlobal('fetch', fetchMock)

    const firstCall = service.fetchPointValues()
    await vi.advanceTimersByTimeAsync(1000)
    await firstCall
    const afterFirst = fetchMock.mock.calls.length

    const secondCall = service.fetchPointValues()
    await vi.advanceTimersByTimeAsync(1000)
    await secondCall

    expect(fetchMock.mock.calls.length).toBeGreaterThan(afterFirst)
  })
})
