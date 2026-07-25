import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

const mockImageryProviderInstances: any[] = []

vi.mock('cesium', () => ({
  ImageryLayer: class {
    show = true
    alpha = 1
    constructor(public imageryProvider: any, options?: any) {
      Object.assign(this, options)
    }
  },
  UrlTemplateImageryProvider: class {
    constructor(public options: any) {
      mockImageryProviderInstances.push(this)
    }
  },
  GeographicTilingScheme: class {},
  Rectangle: {
    fromDegrees: (...args: number[]) => ({ args }),
  },
}))

// Each layer's fetchCogInfo resolves via its own deferred promise, so the test
// controls resolution order independently of call order.
const deferredByFilename = new Map<string, { resolve: (v: any) => void }>()

vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      thorium_grs: { filename: 'thorium_grs.tif', displayName: 'Thorium GRS' },
      thorium_count_rate_wilson: { filename: 'thorium_count_rate.tif', displayName: 'Thorium Count Rate' },
      thorium_kaguya_grs: { filename: 'thorium_kaguya.tif', displayName: 'Thorium Kaguya' },
    },
  },
  buildCogTileUrl: (filename: string) => `https://example.test/${filename}`,
  fetchCogInfo: (filename: string) =>
    new Promise(resolve => {
      deferredByFilename.set(filename, { resolve })
    }),
  fetchCogStatistics: vi.fn(),
  getLayersByCompound: (): string[] => [],
}))

vi.mock('services/ColormapService', () => ({
  colormapService: { getColormapFirstColor: () => '#000000' },
}))

vi.mock('services/LayerStatsService', () => ({
  layerStatsService: { getLayerStats: () => ({ min: 0, max: 100, loaded: false }) },
}))

vi.mock('services/PointValueService', () => ({
  pointValueService: {
    setLayerBounds: vi.fn().mockResolvedValue(undefined),
    enableMouseTracking: vi.fn(),
    updateActiveFilename: vi.fn(),
  },
}))

vi.mock('utils/MouseTrackingProvider', () => ({
  useMouseTracking: () => ({ hasDisableRequests: () => false }),
}))

const fakeImageryLayers = {
  order: [] as any[],
  add(layer: any) {
    this.order.push(layer)
  },
  remove(layer: any) {
    this.order = this.order.filter(l => l !== layer)
  },
  contains(layer: any) {
    return this.order.includes(layer)
  },
  indexOf(layer: any) {
    return this.order.indexOf(layer)
  },
}

vi.mock('utils/context/ViewerContext', () => ({
  useViewer: () => ({ viewer: { imageryLayers: fakeImageryLayers } }),
}))

import { LayerProvider, useLayerContext } from './LayerContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <LayerProvider>{children}</LayerProvider>
)

describe('addLayer insertion order', () => {
  it('inserts into imageryLayers in call order, not fetchCogInfo resolution order', async () => {
    fakeImageryLayers.order = []
    deferredByFilename.clear()

    const { result } = renderHook(() => useLayerContext(), { wrapper })

    act(() => {
      result.current.addLayer('thorium_grs')
      result.current.addLayer('thorium_count_rate_wilson')
      result.current.addLayer('thorium_kaguya_grs')
    })

    await waitFor(() => {
      expect(deferredByFilename.size).toBe(3)
    })

    // Resolve out of call order: the count-rate layer (called second) finishes last.
    act(() => {
      deferredByFilename.get('thorium_grs.tif')!.resolve({ bounds: [0, 0, 1, 1] })
    })
    act(() => {
      deferredByFilename.get('thorium_kaguya.tif')!.resolve({ bounds: [0, 0, 1, 1] })
    })
    act(() => {
      deferredByFilename.get('thorium_count_rate.tif')!.resolve({ bounds: [0, 0, 1, 1] })
    })

    await waitFor(() => {
      expect(fakeImageryLayers.order).toHaveLength(3)
    })

    const insertedUrls = fakeImageryLayers.order.map(
      (layer: any) => layer.imageryProvider.options.url
    )

    expect(insertedUrls).toEqual([
      'https://example.test/thorium_grs.tif',
      'https://example.test/thorium_count_rate.tif',
      'https://example.test/thorium_kaguya.tif',
    ])
  })
})
