// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Cesium from 'cesium'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import type { LayersConfig } from 'types/layers'
import { buildInspectorLines } from './inspectorLayers'
import { InspectorStore, type InspectorDependencies } from './InspectorStore'
import { RequestQueue } from './RequestQueue'
import type { FeatureStatistics } from './inspectorStatistics'
import { LINE_SAMPLE_COUNT } from './featureGeometry'

const config: LayersConfig = {
  layers: {
    global: { filename: 'global.tif', category: 'chemical', element: 'iron', units: 'wt%', stac: 'global.json' },
    band: { filename: 'band.tif', category: 'mineral', mineral: 'olivine', units: 'wt%', stac: 'band.json' },
    pole_north: { filename: 'north.tif', category: 'mineral', mineral: 'plagioclase', units: 'wt%', inspectorPair: 'pole' },
    pole_south: { filename: 'south.tif', category: 'mineral', mineral: 'plagioclase', units: 'wt%', inspectorPair: 'pole' },
  },
}
const lines = buildInspectorLines(config)

const BOUNDS: Record<string, number[]> = {
  'global.tif': [-180, -90, 180, 90],
  'band.tif': [-180, -50, 180, 50],
  'north.tif': [-180, 49.8, 180, 90],
  'south.tif': [-180, -90, 180, -49.8],
}

const shapeStats = (mean: number): FeatureStatistics => ({
  mean, median: mean, std: 1, min: mean - 2, max: mean + 2, p15: mean - 1, p85: mean + 1, count: 10, coverage: 80,
})

const deg = (lon: number, lat: number) => Cesium.Cartographic.fromDegrees(lon, lat)

const feature = (id: string, type: Feature['type'], metadata: Partial<Feature['metadata']>): Feature => ({
  id, type, name: id, entity: {} as Cesium.Entity, color: '#fff',
  metadata: { createdAt: new Date(0), ...metadata },
  inspectorOpen: false, visible: true,
})

const point = (lon: number, lat: number, id = 'p') => feature(id, 'point', { position: deg(lon, lat) })
const square = (lon: number, lat: number, size = 2, id = 's') => feature(id, 'polygon', {
  positions: [deg(lon, lat), deg(lon + size, lat), deg(lon + size, lat + size), deg(lon, lat + size)],
})

function setup(overrides: Partial<InspectorDependencies> = {}) {
  const deps: InspectorDependencies = {
    lines,
    fetchBounds: vi.fn(async (filename: string) => BOUNDS[filename]),
    fetchResolution: vi.fn(async (stac?: string) => (stac === 'global.json' ? 150 : undefined)),
    fetchPointValues: vi.fn(async (filenames: string[]) =>
      new Map(filenames.map(f => [f, f === 'band.tif' ? null : 7] as [string, number | null]))),
    fetchShapeStatistics: vi.fn(async (filename: string) => (filename === 'band.tif' ? null : shapeStats(5))),
    sampleElevation: vi.fn(async () => ({ value: -100, lowest: -200, highest: 0 })),
    areaQueue: new RequestQueue(4),
    sampleQueue: new RequestQueue(4),
    editSettleMs: 600,
    ...overrides,
  }
  return { deps, store: new InspectorStore(deps) }
}

const settle = async () => {
  for (let i = 0; i < 20; i++) await new Promise(resolve => setTimeout(resolve, 0))
}

describe('InspectorStore, points', () => {
  it('reads every line in one request and sorts out no data', async () => {
    const { store, deps } = setup()
    store.sync([point(10, 60)])
    expect(store.get('p')?.status).toBe('computing')
    await settle()

    const result = store.get('p')!
    expect(result.status).toBe('ready')
    expect(result.done).toBe(result.total)
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(1)
    expect(vi.mocked(deps.fetchPointValues).mock.calls[0][0]).toEqual(['global.tif', 'north.tif'])
    expect(result.lines.global).toMatchObject({ value: 7 })
    expect(result.lines.band).toMatchObject({ noData: 'outside', extent: '50°N to 50°S' })
    expect(result.lines.pole).toMatchObject({ value: 7, file: { filename: 'north.tif' } })
    expect(result.elevation).toEqual({ value: -100, lowest: -200, highest: 0 })
  })

  it('reads no data inside a dataset as such', async () => {
    const { store } = setup()
    store.sync([point(10, 0)])
    await settle()
    const result = store.get('p')!
    expect(result.lines.band).toMatchObject({ noData: 'inside' })
    expect(result.lines.pole).toMatchObject({ noData: 'outside', extent: 'the poles, from 50° latitude' })
  })

  it('marks every requested line failed when the request fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store } = setup({ fetchPointValues: vi.fn(async () => { throw new Error('down') }) })
    store.sync([point(10, 0)])
    await settle()
    const result = store.get('p')!
    expect(result.failedRequests).toBe(1)
    expect(result.lines.global).toMatchObject({ failed: true })
    expect(result.lines.pole).toMatchObject({ noData: 'outside' })
  })

  it('treats unknown bounds as global', async () => {
    const { store, deps } = setup({ fetchBounds: vi.fn(async () => { throw new Error('no info') }) })
    store.sync([point(10, 70)])
    await settle()
    expect(vi.mocked(deps.fetchPointValues).mock.calls[0][0]).toEqual(['global.tif', 'band.tif', 'north.tif'])
  })
})

describe('InspectorStore, shapes', () => {
  it('requests each line inside its dataset and keeps the results', async () => {
    const { store, deps } = setup()
    store.sync([square(10, -70)])
    await settle()

    const result = store.get('s')!
    expect(result.status).toBe('ready')
    expect(result.done).toBe(3)
    expect(result.areaKm2).toBeGreaterThan(0)
    expect(result.lines.global).toMatchObject({ value: 5, resolutionKm: 150, stats: { coverage: 80 } })
    expect(result.lines.band).toMatchObject({ noData: 'outside' })
    expect(result.lines.pole).toMatchObject({ value: 5, file: { filename: 'south.tif' } })
    expect(vi.mocked(deps.fetchShapeStatistics).mock.calls.map(c => c[0])).toEqual(['global.tif', 'south.tif'])
    const geojson = vi.mocked(deps.fetchShapeStatistics).mock.calls[0][1] as { geometry: { coordinates: number[][][] } }
    expect(geojson.geometry.coordinates[0]).toHaveLength(5)
  })

  it('reads no data inside the dataset and counts failures', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store } = setup({
      fetchShapeStatistics: vi.fn(async (filename: string) => {
        if (filename === 'band.tif') return null
        throw new Error('timeout')
      }),
    })
    store.sync([square(10, 10)])
    await settle()
    const result = store.get('s')!
    expect(result.lines.band).toMatchObject({ noData: 'inside' })
    expect(result.lines.global).toMatchObject({ failed: true })
    expect(result.failedRequests).toBe(1)
  })

  it('holds area requests while paused', async () => {
    const { store, deps } = setup()
    store.pauseAreas()
    store.sync([square(10, 10)])
    await settle()
    expect(deps.fetchShapeStatistics).not.toHaveBeenCalled()
    expect(store.get('s')!.status).toBe('computing')

    store.resumeAreas()
    await settle()
    expect(store.get('s')!.status).toBe('ready')
  })

  it('converts a circle to a polygon', async () => {
    const { store, deps } = setup()
    store.sync([feature('c', 'circle', { center: deg(0, 0), radius: 20_000 })])
    await settle()
    const geojson = vi.mocked(deps.fetchShapeStatistics).mock.calls[0][1] as { geometry: { coordinates: number[][][] } }
    expect(geojson.geometry.coordinates[0].length).toBeGreaterThan(20)
    expect(store.get('c')!.kind).toBe('shape')
  })

  it('finishes a shape without a ring at once', async () => {
    const { store } = setup()
    store.sync([feature('x', 'polygon', { positions: [deg(0, 0)] })])
    await settle()
    expect(store.get('x')!.status).toBe('ready')
  })
})

describe('InspectorStore, lines', () => {
  const traverse = (id = 'l') => feature(id, 'line', { positions: [deg(0, 40), deg(0, 60)] })

  it('reads every sample and computes statistics over them', async () => {
    const { store, deps } = setup({
      fetchPointValues: vi.fn(async (filenames: string[], position) =>
        new Map(filenames.map(f => [f, f === 'global.tif' ? position.lat : 3] as [string, number | null]))),
    })
    store.sync([traverse()])
    await settle()

    const result = store.get('l')!
    expect(result.status).toBe('ready')
    expect(result.samples).toHaveLength(LINE_SAMPLE_COUNT)
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(LINE_SAMPLE_COUNT)
    expect(result.lines.global.profile![0]).toBeCloseTo(40)
    expect(result.lines.global.value).toBeCloseTo(50, 0)
    // The band file ends at 50°N, so about half the samples hold data
    expect(result.lines.band.stats!.coverage).toBeGreaterThan(40)
    expect(result.lines.band.stats!.coverage).toBeLessThan(60)
    expect(result.lines.pole).toMatchObject({ file: { filename: 'north.tif' } })
    expect(result.done).toBe(result.total)
  })

  it('reads no data along a line outside a dataset', async () => {
    const { store } = setup()
    store.sync([feature('l', 'line', { positions: [deg(0, 0), deg(5, 0)] })])
    await settle()
    expect(store.get('l')!.lines.pole).toMatchObject({ noData: 'outside' })
    expect(store.get('l')!.lines.band).toMatchObject({ noData: 'inside' })
  })

  it('marks every line failed when every sample fails', async () => {
    const { store } = setup({ fetchPointValues: vi.fn(async () => { throw new Error('down') }) })
    store.sync([traverse()])
    await settle()
    const result = store.get('l')!
    expect(result.failedRequests).toBe(LINE_SAMPLE_COUNT)
    expect(result.lines.global).toMatchObject({ failed: true })
  })

  it('keeps the samples that answered when some fail', async () => {
    let calls = 0
    const { store } = setup({
      fetchPointValues: vi.fn(async (filenames: string[]) => {
        if (calls++ === 0) throw new Error('down')
        return new Map(filenames.map(f => [f, 1] as [string, number | null]))
      }),
    })
    store.sync([traverse()])
    await settle()
    const result = store.get('l')!
    expect(result.failedRequests).toBe(1)
    expect(result.lines.global.value).toBe(1)
  })
})

describe('InspectorStore, lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }) })
  afterEach(() => { vi.useRealTimers() })

  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
  }

  it('reuses results while the geometry is unchanged', async () => {
    const { store, deps } = setup()
    const p = point(10, 0)
    store.sync([p])
    await flush()
    store.sync([{ ...p, name: 'renamed' }])
    await flush()
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(1)
  })

  it('recomputes once an edit settles, keeping the old values until then', async () => {
    const { store, deps } = setup()
    store.sync([point(10, 0)])
    await flush()

    store.sync([point(11, 0)])
    vi.advanceTimersByTime(300)
    store.sync([point(12, 0)])
    vi.advanceTimersByTime(300)
    expect(store.get('p')!.status).toBe('ready')
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(300)
    expect(store.get('p')!.status).toBe('computing')
    await flush()
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(2)
    expect(vi.mocked(deps.fetchPointValues).mock.calls[1][1].lon).toBeCloseTo(12)
  })

  it('drops the results of a deleted feature and cancels its requests', async () => {
    const { store, deps } = setup()
    store.pauseAreas()
    store.sync([square(10, 10)])
    await flush()
    store.sync([])
    expect(store.get('s')).toBeUndefined()
    store.resumeAreas()
    await flush()
    expect(deps.fetchShapeStatistics).not.toHaveBeenCalled()
  })

  it('drops a pending edit with its feature', async () => {
    const { store, deps } = setup()
    store.sync([point(10, 0)])
    await flush()
    store.sync([point(11, 0)])
    store.sync([])
    vi.advanceTimersByTime(1000)
    await flush()
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(1)
  })

  it('computes again on retry', async () => {
    const { store, deps } = setup()
    store.sync([point(10, 0)])
    await flush()
    store.retry('p')
    store.retry('unknown')
    await flush()
    expect(deps.fetchPointValues).toHaveBeenCalledTimes(2)
  })

  it('notifies subscribers and counts versions', async () => {
    const { store } = setup()
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)
    const before = store.getVersion()
    store.sync([point(10, 0)])
    await flush()
    expect(listener).toHaveBeenCalled()
    expect(store.getVersion()).toBeGreaterThan(before)

    unsubscribe()
    listener.mockClear()
    store.dispose()
    expect(listener).not.toHaveBeenCalled()
  })
})
