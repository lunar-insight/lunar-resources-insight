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
