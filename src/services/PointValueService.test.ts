vi.mock('../geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      layer_a: { filename: 'a.tif', category: 'chemical', element: 'iron', units: 'wt%' },
      layer_b: { filename: 'b.tif', category: 'chemical', element: 'thorium', units: 'ppm' },
    },
  },
  pointIndexAssetKey: (filename: string) => filename.replace(/\.[^.]*$/, ''),
  pointIndexAssetsUrl: 'http://example.test/point-index/assets.json',
  getBatchedPointValueUrl: vi.fn(() => 'http://example.test/stac/point'),
}))

vi.mock('../components/viewer/ScanIndicator/ScanIndicator', () => ({
  ScanIndicator: vi.fn(function (this: any) {
    this.setViewer = vi.fn();
    this.hide = vi.fn();
    this.updatePosition = vi.fn();
    this.showAt = vi.fn();
    this.destroy = vi.fn();
  }),
}))

// Input actions set by the service, by event type, for tests that fire them.
const inputActions: Record<string, (event: unknown) => void> = {}

vi.mock('cesium', () => ({
  Math: { toDegrees: (rad: number) => rad },
  ScreenSpaceEventHandler: class {
    setInputAction(action: (event: unknown) => void, type: string) { inputActions[type] = action }
    destroy() {}
  },
  ScreenSpaceEventType: { LEFT_DOWN: 'LEFT_DOWN', LEFT_UP: 'LEFT_UP', MOUSE_MOVE: 'MOUSE_MOVE' },
}))

import { PointValueService, type PointValueCallbackData } from './PointValueService'
import { getBatchedPointValueUrl } from '../geoConfigExporter'

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
      // No terrain answers, so picking falls back to the ellipsoid.
      getPickRay: (): undefined => undefined,
      pickEllipsoid: (position: { x: number; y: number }) => ({
        x: position.x,
        y: position.y,
        z: 0,
      }),
    },
  }
}

// One /stac/point response: one value per asset, with the asset names in
// band_descriptions.
function resolvedFetch(values: (number | null)[], assetKeys: string[] = ['a']) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      coordinates: [0, 0],
      values,
      band_names: assetKeys.map((_, index) => `b${index + 1}`),
      band_descriptions: assetKeys,
    }),
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

  it('reports no data when an asset returns null', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([null])))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates[0]).toEqual({ values: {}, unavailableLayerIds: [], isPaused: false })
  })

  it('reports unavailable without retrying when the index does not hold an asset', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => failedFetch(404))
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates[0]).toEqual({
      values: {},
      unavailableLayerIds: ['layer_a'],
      isPaused: false,
    })
    // A retry returns the same 404.
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

describe('PointValueService: one request across the selection', () => {
  it('reads every selected layer in a single request', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a', 'layer_b']

    const fetchMock = vi.fn(() => resolvedFetch([7.6, 2.2], ['a', 'b']))
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(updates[0]).toEqual({
      values: { layer_a: 7.6, layer_b: 2.2 },
      unavailableLayerIds: [],
      isPaused: false,
    })
  })

  it('maps values by asset name and not by request order', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a', 'layer_b']

    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([2.2, 7.6], ['b', 'a'])))

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.fetchPointValues()

    expect(updates[0].values).toEqual({ layer_a: 7.6, layer_b: 2.2 })
  })

  it('drops a layer the index does not hold and scans for the rest', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a', 'layer_b']

    const fetchMock = vi.fn((url: string) =>
      url.includes('assets.json')
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ assets: ['a'] }) })
        : resolvedFetch([7.6], ['a'])
    )
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.loadIndexAssetKeys()
    await service.fetchPointValues()

    expect(updates[0]).toEqual({
      values: { layer_a: 7.6 },
      unavailableLayerIds: ['layer_b'],
      isPaused: false,
    })
  })

  it('issues no request when the index holds none of the selected layers', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_b']

    const fetchMock = vi.fn((url: string) =>
      url.includes('assets.json')
        ? Promise.resolve({ ok: true, status: 200, json: async () => ({ assets: ['a'] }) })
        : resolvedFetch([7.6], ['a'])
    )
    vi.stubGlobal('fetch', fetchMock)

    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    await service.loadIndexAssetKeys()
    await service.fetchPointValues()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(updates[0]).toEqual({
      values: {},
      unavailableLayerIds: ['layer_b'],
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

  it('reads a new selection at the same point when it changes during a fetch', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.selectedLayers = ['layer_a']
    vi.mocked(getBatchedPointValueUrl).mockClear()

    let resolveFirst: (value: unknown) => void = () => {}
    const fetchMock = vi.fn()
      .mockReturnValueOnce(new Promise(resolve => { resolveFirst = resolve }))
      .mockReturnValue(resolvedFetch([7.6, 2.5], ['a', 'b']))
    vi.stubGlobal('fetch', fetchMock)

    // The cursor stops, and a fetch goes out for the first selection.
    service.currentMousePosition = { x: 10, y: 10 }
    service.throttledFetchPointValues()

    // A scanner window opens before that fetch answers.
    service.setSelectedLayers(['layer_a', 'layer_b'])
    resolveFirst(await resolvedFetch([7.6]))
    await vi.advanceTimersByTimeAsync(500)

    // The first answer covered only layer_a, so the point is read again for both.
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getBatchedPointValueUrl).mock.calls.map(([assets]) => assets)).toEqual([['a'], ['a', 'b']])
  })

  it('resamples the current point when the selection changes', async () => {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.currentMousePosition = { x: 10, y: 10 }
    service.selectedLayers = ['layer_a']

    const fetchMock = vi.fn(() => resolvedFetch([7.6, 2.2], ['a', 'b']))
    vi.stubGlobal('fetch', fetchMock)

    await service.fetchPointValues()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // Opening a scanner window adds its layers while the cursor is stationary.
    service.setSelectedLayers(['layer_a', 'layer_b'])
    await vi.advanceTimersByTimeAsync(200)

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

describe('PointValueService: holding on a spot', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  function activeService() {
    const service = new PointValueService() as any
    service.viewer = makeFakeViewer()
    service.isActive = true
    service.selectedLayers = ['layer_a']
    return service
  }

  // The batched URL mock records the requested lon and lat.
  const requestedPoints = () =>
    vi.mocked(getBatchedPointValueUrl).mock.calls.map(([, lon, lat]) => [lon, lat])

  beforeEach(() => { vi.mocked(getBatchedPointValueUrl).mockClear() })

  it('reads the held spot and keeps it while the cursor moves', async () => {
    const service = activeService()
    service.setViewer(service.viewer)
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))
    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    service.holdAt({ x: 5, y: 6, z: 0 })
    await vi.advanceTimersByTimeAsync(10)
    expect(service.scanIndicator.showAt).toHaveBeenCalledWith({ x: 5, y: 6, z: 0 })
    expect(requestedPoints()).toEqual([[5, 6]])
    expect(updates.at(-1)).toEqual({ values: { layer_a: 4.2 }, unavailableLayerIds: [], isPaused: false })

    inputActions.MOUSE_MOVE({ endPosition: { x: 30, y: 40 } })
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[5, 6]])
    expect(service.scanIndicator.updatePosition).not.toHaveBeenCalled()
    expect(service.currentMousePosition).toEqual({ x: 30, y: 40 })
  })

  it('keeps the held values while mouse tracking is disabled', async () => {
    const service = activeService()
    let resolveFetch: (value: unknown) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveFetch = resolve })))
    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    service.holdAt({ x: 5, y: 6, z: 0 })
    // The cursor moves onto the menu, off the canvas.
    service.disableMouseTracking()
    expect(service.scanIndicator.hide).not.toHaveBeenCalled()

    resolveFetch(await resolvedFetch([4.2]))
    await vi.advanceTimersByTimeAsync(10)
    expect(updates).toEqual([{ values: { layer_a: 4.2 }, unavailableLayerIds: [], isPaused: false }])

    // Tracking coming back does not move the reading to the cursor.
    service.currentMousePosition = { x: 30, y: 40 }
    service.enableMouseTracking()
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[5, 6]])
  })

  it('samples the held spot again when the selection changes', async () => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))

    service.holdAt({ x: 5, y: 6, z: 0 })
    service.disableMouseTracking()
    await vi.advanceTimersByTimeAsync(10)
    // Within the throttle interval, so the fetch waits for its turn.
    service.setSelectedLayers(['layer_a', 'layer_b'])
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[5, 6], [5, 6]])
  })

  it('resumes at the cursor once released', async () => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))
    service.currentMousePosition = { x: 30, y: 40 }

    const token = service.holdAt({ x: 5, y: 6, z: 0 })
    service.releaseHold(token)
    await vi.advanceTimersByTimeAsync(500)

    expect(service.scanIndicator.updatePosition).toHaveBeenCalledWith({ x: 30, y: 40 })
    expect(requestedPoints()).toEqual([[5, 6], [30, 40]])
  })

  it('pauses on release when the cursor is off the canvas', async () => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))
    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))

    const token = service.holdAt({ x: 5, y: 6, z: 0 })
    service.disableMouseTracking()
    service.releaseHold(token)
    await vi.advanceTimersByTimeAsync(500)

    expect(service.scanIndicator.hide).toHaveBeenCalled()
    expect(updates).toEqual([{ values: {}, unavailableLayerIds: [], isPaused: true }])
  })

  it('hides the indicator on release when the cursor never moved', () => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))

    service.releaseHold(service.holdAt({ x: 5, y: 6, z: 0 }))
    expect(service.scanIndicator.hide).toHaveBeenCalled()
  })

  it('ignores the token of an earlier hold', async () => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))

    const first = service.holdAt({ x: 5, y: 6, z: 0 })
    service.holdAt({ x: 7, y: 8, z: 0 })
    service.releaseHold(first)
    expect(service.heldPosition).toEqual({ lon: 7, lat: 8 })
  })

  it('holds without sampling while no scanner is open', async () => {
    const service = activeService()
    service.isActive = false
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))

    const token = service.holdAt({ x: 5, y: 6, z: 0 })
    expect(service.heldPosition).toEqual({ lon: 5, lat: 6 })
    service.releaseHold(token)
    await vi.advanceTimersByTimeAsync(500)

    expect(service.heldPosition).toBeNull()
    expect(requestedPoints()).toEqual([])
    expect(service.scanIndicator.showAt).not.toHaveBeenCalled()
  })

  it('does not hold without a viewer', () => {
    const service = new PointValueService() as any
    const token = service.holdAt({ x: 5, y: 6, z: 0 })
    expect(service.heldPosition).toBeNull()
    expect(() => service.releaseHold(token)).not.toThrow()
  })
})

describe('PointValueService: following the cursor', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(getBatchedPointValueUrl).mockClear()
  })
  afterEach(() => { vi.useRealTimers() })

  const requestedPoints = () =>
    vi.mocked(getBatchedPointValueUrl).mock.calls.map(([, lon, lat]) => [lon, lat])

  function activeService() {
    const service = new PointValueService() as any
    service.setViewer(makeFakeViewer())
    service.isActive = true
    service.selectedLayers = ['layer_a']
    vi.stubGlobal('fetch', vi.fn(() => resolvedFetch([4.2])))
    return service
  }

  it('moves the indicator with the cursor and reads under it', async () => {
    const service = activeService()
    inputActions.MOUSE_MOVE({ endPosition: { x: 30, y: 40 } })
    await vi.advanceTimersByTimeAsync(10)
    expect(service.scanIndicator.updatePosition).toHaveBeenCalledWith({ x: 30, y: 40 })
    expect(requestedPoints()).toEqual([[30, 40]])
  })

  it('reads under the cursor again when tracking comes back', async () => {
    const service = activeService()
    service.currentMousePosition = { x: 30, y: 40 }
    service.disableMouseTracking()
    service.enableMouseTracking()
    await vi.advanceTimersByTimeAsync(10)
    expect(requestedPoints()).toEqual([[30, 40]])
  })

  it('cancels a waiting fetch for the cursor when a hold starts', async () => {
    const service = activeService()
    service.currentMousePosition = { x: 30, y: 40 }
    service.throttledFetchPointValues()
    service.currentMousePosition = { x: 31, y: 41 }
    service.throttledFetchPointValues()
    service.holdAt({ x: 5, y: 6, z: 0 })
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[30, 40], [5, 6]])
  })

  it('reads nothing for an empty selection while held', async () => {
    const service = activeService()
    service.holdAt({ x: 5, y: 6, z: 0 })
    await vi.advanceTimersByTimeAsync(10)
    service.setSelectedLayers([])
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[5, 6]])
  })

  it('drops a waiting fetch once the scanner is no longer active', async () => {
    const service = activeService()
    service.currentMousePosition = { x: 30, y: 40 }
    service.throttledFetchPointValues()
    service.currentMousePosition = { x: 31, y: 41 }
    service.throttledFetchPointValues()
    service.isActive = false
    await vi.advanceTimersByTimeAsync(500)
    expect(requestedPoints()).toEqual([[30, 40]])
  })

  it('reports a pause when asked to read with nothing to read', async () => {
    const service = activeService()
    service.isMouseTrackingEnabled = false
    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))
    await service.fetchPointValues()
    expect(updates).toEqual([{ values: {}, unavailableLayerIds: [], isPaused: true }])
  })

  it.each([
    ['answers', () => resolvedFetch([4.2])],
    ['fails', () => failedFetch(502)],
  ])('discards a batch that %s after sampling stopped', async (_label, response) => {
    const service = activeService()
    vi.stubGlobal('fetch', vi.fn(response))
    const updates: PointValueCallbackData[] = []
    service.onValuesUpdate((data: PointValueCallbackData) => updates.push(data))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    service.currentMousePosition = { x: 30, y: 40 }
    const fetching = service.fetchPointValues()
    service.isMouseTrackingEnabled = false
    await vi.advanceTimersByTimeAsync(500)
    await fetching
    expect(updates).toEqual([])
  })
})
