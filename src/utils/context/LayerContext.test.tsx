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
    destroy() {}
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

// Each layer's fetchLayerBounds resolves via its own deferred promise, so the test
// controls resolution order independently of call order.
const deferredByFilename = new Map<string, { resolve: (v: any) => void }>()

vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      thorium_grs: { filename: 'thorium_grs.tif', displayName: 'Thorium GRS' },
      thorium_count_rate_wilson: { filename: 'thorium_count_rate.tif', displayName: 'Thorium Count Rate' },
      thorium_kaguya_grs: { filename: 'thorium_kaguya.tif', displayName: 'Thorium Kaguya' },
      feo: {
        filename: 'feo_2.tif',
        displayName: 'FeO',
        variants: [{ label: '2°', filename: 'feo_2.tif' }, { label: '5°', filename: 'feo_5.tif' }],
      },
    },
  },
  buildCogTileUrl: (filename: string, options?: { colormap?: string }) =>
    `https://example.test/${filename}${options?.colormap ? `?colormap=${options.colormap}` : ''}`,
  fetchLayerBounds: (filename: string) =>
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
  layerStatsService: {
    getLayerStats: () => ({ min: 2, max: 40, loaded: true }),
    getFileStats: () => ({ min: 3, max: 50, loaded: true }),
    setActiveFile: vi.fn().mockResolvedValue({ min: 0, max: 100, loaded: false }),
    clearActiveFile: vi.fn(),
  },
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

function setup() {
  fakeImageryLayers.order = []
  deferredByFilename.clear()
  return renderHook(() => useLayerContext(), { wrapper }).result
}

/** Adds a layer and lets it reach the map. */
async function addToMap(
  result: { current: ReturnType<typeof useLayerContext> },
  layer: string,
  filename: string,
  options?: { colormap?: string; fromInspector?: boolean },
) {
  const before = fakeImageryLayers.order.length
  act(() => result.current.addLayer(layer, undefined, options))
  await waitFor(() => expect(deferredByFilename.has(filename)).toBe(true))
  act(() => deferredByFilename.get(filename)!.resolve([0, 0, 1, 1]))
  await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(before + 1))
}

const flush = () => act(() => new Promise(resolve => setTimeout(resolve, 0)))

describe('addLayer twice', () => {
  it('gives one list entry', () => {
    const result = setup()
    act(() => {
      result.current.addLayer('thorium_grs')
      result.current.addLayer('thorium_grs')
    })
    expect(result.current.selectedLayers).toEqual(['thorium_grs'])
  })

  it('makes one imagery layer', async () => {
    const result = setup()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif')
    act(() => result.current.addLayer('thorium_grs'))
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(1)
  })

  it('makes one imagery layer while the first add is pending', async () => {
    const result = setup()
    act(() => {
      result.current.addLayer('thorium_grs')
      result.current.addLayer('thorium_grs')
    })
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(1))
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(1)
  })
})

describe('removeLayer while an add is pending', () => {
  it('leaves no imagery layer', async () => {
    const result = setup()
    act(() => result.current.addLayer('thorium_grs'))
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    act(() => result.current.removeLayer('thorium_grs'))
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(0)
    expect(result.current.selectedLayers).toEqual([])
  })

  it('stops when the remove arrives while the bounds are stored', async () => {
    const result = setup()
    const { pointValueService } = await import('services/PointValueService')
    let finishBounds: (() => void) | undefined
    vi.mocked(pointValueService.setLayerBounds).mockImplementationOnce(
      () => new Promise<void>(resolve => { finishBounds = resolve }),
    )
    act(() => result.current.addLayer('thorium_grs'))
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(finishBounds).toBeDefined())
    act(() => result.current.removeLayer('thorium_grs'))
    finishBounds!()
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(0)
  })

  it('stops while waiting for the insert slot', async () => {
    const result = setup()
    act(() => {
      result.current.addLayer('thorium_grs')
      result.current.addLayer('thorium_kaguya_grs')
    })
    await waitFor(() => expect(deferredByFilename.size).toBe(2))
    act(() => deferredByFilename.get('thorium_kaguya.tif')!.resolve([0, 0, 1, 1]))
    await flush()
    act(() => result.current.removeLayer('thorium_kaguya_grs'))
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(1))
    await flush()
    expect(fakeImageryLayers.order.map((l: any) => l.imageryProvider.options.url))
      .toEqual(['https://example.test/thorium_grs.tif'])
  })

  it('lets a later add of the same layer through, and only that one', async () => {
    const result = setup()
    act(() => result.current.addLayer('thorium_grs'))
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    const first = deferredByFilename.get('thorium_grs.tif')!
    act(() => result.current.removeLayer('thorium_grs'))
    deferredByFilename.clear()
    act(() => result.current.addLayer('thorium_grs'))
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    act(() => first.resolve([0, 0, 1, 1]))
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(0)
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(1))
  })

  it('keeps later adds in call order behind an earlier add still pending', async () => {
    const result = setup()
    act(() => {
      result.current.addLayer('thorium_grs')
      result.current.addLayer('thorium_count_rate_wilson')
      result.current.addLayer('thorium_kaguya_grs')
    })
    await waitFor(() => expect(deferredByFilename.size).toBe(3))
    act(() => result.current.removeLayer('thorium_count_rate_wilson'))
    act(() => deferredByFilename.get('thorium_count_rate.tif')!.resolve([0, 0, 1, 1]))
    act(() => deferredByFilename.get('thorium_kaguya.tif')!.resolve([0, 0, 1, 1]))
    await flush()
    expect(fakeImageryLayers.order).toHaveLength(0)
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(2))
    expect(fakeImageryLayers.order.map((l: any) => l.imageryProvider.options.url)).toEqual([
      'https://example.test/thorium_grs.tif',
      'https://example.test/thorium_kaguya.tif',
    ])
  })
})

describe('removeLayer', () => {
  it('forgets the style, so a new add starts clean', async () => {
    const result = setup()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif')
    await act(() => result.current.updateStyle('thorium_grs', { type: 'magma', colors: [], min: 1, max: 2 }))
    expect(result.current.getLayerStyle('thorium_grs')?.type).toBe('magma')
    act(() => result.current.removeLayer('thorium_grs'))
    expect(result.current.getLayerStyle('thorium_grs')).toBeUndefined()
    deferredByFilename.clear()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif')
    expect(result.current.getLayerStyle('thorium_grs')).toBeUndefined()
  })

  it('forgets the lock and the filter', async () => {
    const result = setup()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif', { colormap: 'viridis' })
    act(() => {
      result.current.updateLayerGradientLock('thorium_grs', true)
      result.current.updateLayerRangeFilter('thorium_grs', true)
    })
    act(() => result.current.removeLayer('thorium_grs'))
    deferredByFilename.clear()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif', { colormap: 'viridis' })
    await act(() => result.current.updateRampValues('thorium_grs', 5, 15))
    expect(result.current.getMapDisplay('thorium_grs')).toEqual({ colormap: 'viridis', rescale: [5, 15], filter: null })
  })
})

describe('addLayer with a colormap', () => {
  it('sets the style before the first request ends and builds the first URL with it', async () => {
    const result = setup()
    act(() => result.current.addLayer('thorium_grs', undefined, { colormap: 'viridis' }))
    expect(result.current.getLayerStyle('thorium_grs')).toEqual({ type: 'viridis', colors: [] })
    await waitFor(() => expect(deferredByFilename.has('thorium_grs.tif')).toBe(true))
    act(() => deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1]))
    await waitFor(() => expect(fakeImageryLayers.order).toHaveLength(1))
    expect(fakeImageryLayers.order[0].imageryProvider.options.url).toBe('https://example.test/thorium_grs.tif?colormap=viridis')
    expect(result.current.getLayerStyle('thorium_grs')).toEqual({ type: 'viridis', colors: [], min: 2, max: 40 })
  })

  it('sends no colormap for gray, the default rendering', async () => {
    const result = setup()
    await addToMap(result, 'thorium_grs', 'thorium_grs.tif', { colormap: 'gray' })
    expect(fakeImageryLayers.order[0].imageryProvider.options.url).toBe('https://example.test/thorium_grs.tif')
    expect(result.current.getLayerStyle('thorium_grs')?.type).toBe('gray')
  })
})

describe('getMapDisplay', () => {
  const layer = 'thorium_grs'

  it('is undefined off the map', async () => {
    const result = setup()
    expect(result.current.getMapDisplay(layer)).toBeUndefined()
    await addToMap(result, layer, 'thorium_grs.tif')
    act(() => result.current.removeLayer(layer))
    expect(result.current.getMapDisplay(layer)).toBeUndefined()
  })

  it('reads gray at the file range for a layer without a style', async () => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    expect(result.current.getMapDisplay(layer)).toEqual({ colormap: 'gray', rescale: [2, 40], filter: null })
  })

  it.each([
    [false, false, { colormap: 'magma', rescale: [5, 15], filter: null }],
    [true, false, { colormap: 'magma', rescale: [2, 40], filter: null }],
    [false, true, { colormap: 'magma', rescale: [5, 15], filter: [5, 15] }],
    [true, true, { colormap: 'magma', rescale: [2, 40], filter: [5, 15] }],
  ])('follows lock %s and filter %s', async (locked, filtered, expected) => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    await act(() => result.current.updateStyle(layer, { type: 'magma', colors: [], min: 5, max: 15 }))
    act(() => {
      result.current.updateLayerGradientLock(layer, locked)
      result.current.updateLayerRangeFilter(layer, filtered)
    })
    expect(result.current.getMapDisplay(layer)).toEqual(expected)
  })

  it('applies a filter set before any style only once a style exists', async () => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    act(() => result.current.updateLayerRangeFilter(layer, true))
    expect(result.current.getMapDisplay(layer)?.filter).toBeNull()
    await act(() => result.current.updateRampValues(layer, 5, 15))
    expect(result.current.getMapDisplay(layer)?.filter).toEqual([5, 15])
  })

  it('uses the default range for a style without one', async () => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    await act(() => result.current.updateStyle(layer, { type: 'magma', colors: [] }))
    expect(result.current.getMapDisplay(layer)?.rescale).toEqual([0, 100])
  })

  it('follows a variant swap', async () => {
    const result = setup()
    await addToMap(result, 'feo', 'feo_2.tif')
    await act(async () => {
      const swap = result.current.swapLayerVariant('feo', 1)
      await waitFor(() => expect(deferredByFilename.has('feo_5.tif')).toBe(true))
      deferredByFilename.get('feo_5.tif')!.resolve([0, 0, 1, 1])
      await swap
    })
    expect(result.current.getMapDisplay('feo')?.rescale).toEqual([3, 50])
  })
})

describe('layerStyleVersion and isInspectorLayer', () => {
  const layer = 'thorium_grs'

  async function inspectorLayer() {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif', { colormap: 'gray', fromInspector: true })
    expect(result.current.isInspectorLayer(layer)).toBe(true)
    return result
  }

  it('is off for a layer from the menus', async () => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    expect(result.current.isInspectorLayer(layer)).toBe(false)
  })

  it.each([
    ['style', (r: any) => r.updateStyle(layer, { type: 'magma', colors: [], min: 1, max: 2 })],
    ['range', (r: any) => r.updateRampValues(layer, 1, 2)],
    ['lock', (r: any) => r.updateLayerGradientLock(layer, true)],
    ['filter', (r: any) => r.updateLayerRangeFilter(layer, true)],
    ['opacity', (r: any) => r.updateLayerOpacity(layer, 0.5)],
  ])('a %s change clears it and raises the version', async (_name, change) => {
    const result = await inspectorLayer()
    const version = result.current.layerStyleVersion
    await act(async () => { await change(result.current) })
    expect(result.current.isInspectorLayer(layer)).toBe(false)
    expect(result.current.layerStyleVersion).toBeGreaterThan(version)
  })

  it('a variant change clears it and raises the version', async () => {
    const result = setup()
    await addToMap(result, 'feo', 'feo_2.tif', { fromInspector: true })
    const version = result.current.layerStyleVersion
    await act(async () => {
      const swap = result.current.swapLayerVariant('feo', 1)
      await waitFor(() => expect(deferredByFilename.has('feo_5.tif')).toBe(true))
      deferredByFilename.get('feo_5.tif')!.resolve([0, 0, 1, 1])
      await swap
    })
    expect(result.current.isInspectorLayer('feo')).toBe(false)
    expect(result.current.layerStyleVersion).toBeGreaterThan(version)
  })

  it('removing the layer clears it', async () => {
    const result = await inspectorLayer()
    act(() => result.current.removeLayer(layer))
    expect(result.current.isInspectorLayer(layer)).toBe(false)
  })

  it('an opacity change on a layer not flagged raises nothing, as a slider drag sends one per step', async () => {
    const result = setup()
    await addToMap(result, layer, 'thorium_grs.tif')
    const version = result.current.layerStyleVersion
    act(() => result.current.updateLayerOpacity(layer, 0.5))
    expect(result.current.layerStyleVersion).toBe(version)
  })
})

describe('addLayer insertion order', () => {
  it('inserts into imageryLayers in call order, not fetchLayerBounds resolution order', async () => {
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
      deferredByFilename.get('thorium_grs.tif')!.resolve([0, 0, 1, 1])
    })
    act(() => {
      deferredByFilename.get('thorium_kaguya.tif')!.resolve([0, 0, 1, 1])
    })
    act(() => {
      deferredByFilename.get('thorium_count_rate.tif')!.resolve([0, 0, 1, 1])
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
