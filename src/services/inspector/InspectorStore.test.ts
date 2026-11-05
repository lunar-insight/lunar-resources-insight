// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Cesium from 'cesium'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import type { LayersConfig } from 'types/layers'
import { buildInspectorLines } from './inspectorLayers'
import { defaultDependencies, InspectorStore, MIN_AREA_KM2, type InspectorDependencies } from './InspectorStore'
import {
  fetchClippedRange,
  fetchFileBounds,
  fetchPointValues,
  fetchResolutionKm,
  fetchShapeStatistics,
  sampleElevation,
} from './inspectorRequests'
import { inspectorLines } from './inspectorLayers'
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

const acrossMeridian = (id = 's') => feature(id, 'polygon', {
  positions: [deg(179.5, -1), deg(-179.5, -1), deg(-179.5, 1), deg(179.5, 1)],
})

function setup(overrides: Partial<InspectorDependencies> = {}) {
  const deps: InspectorDependencies = {
    lines,
    fetchBounds: vi.fn(async (filename: string) => BOUNDS[filename]),
    fetchResolution: vi.fn(async (stac?: string) => (stac === 'global.json' ? 150 : undefined)),
    fetchClip: vi.fn(async (stac?: string) => (stac === 'global.json' ? { range: [0, 24] as [number, number] } : undefined)),
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

describe('defaultDependencies', () => {
  it('wires the requests, the Inspector lines and two separate queues', () => {
    const deps = defaultDependencies()
    expect(deps).toMatchObject({
      lines: inspectorLines,
      fetchBounds: fetchFileBounds,
      fetchResolution: fetchResolutionKm,
      fetchClip: fetchClippedRange,
      fetchPointValues,
      fetchShapeStatistics,
      sampleElevation,
    })
    expect(deps.areaQueue).not.toBe(deps.sampleQueue)
  })
})

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

  it('keeps the clipping of each file read', async () => {
    const { store } = setup()
    store.sync([point(10, 60)])
    await settle()
    const result = store.get('p')!
    expect(result.lines.global.clip).toEqual({ range: [0, 24] })
    expect(result.lines.pole.clip).toBeUndefined()
  })

  it('keeps the values when a catalog item fails', async () => {
    const { store } = setup({ fetchClip: vi.fn(async () => { throw new Error('no item') }) })
    store.sync([point(10, 60)])
    await settle()
    expect(store.get('p')!.lines.global).toMatchObject({ value: 7, clip: undefined })
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

  it('finishes without elevation when terrain sampling fails', async () => {
    const { store } = setup({ sampleElevation: vi.fn(async () => { throw new Error('no tiles') }) })
    store.sync([point(10, 60)])
    await settle()
    const result = store.get('p')!
    expect(result.status).toBe('ready')
    expect(result.elevation).toBeNull()
    expect(result.lines.global).toMatchObject({ value: 7 })
  })

  it('finishes a point without a position at once', async () => {
    const { store, deps } = setup()
    store.sync([feature('x', 'point', {})])
    await settle()
    expect(store.get('x')).toMatchObject({ status: 'ready', lines: {} })
    expect(deps.fetchPointValues).not.toHaveBeenCalled()
  })

  it('finishes when a computation fails unexpectedly', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { store } = setup({ fetchBounds: vi.fn(async () => undefined as unknown as number[]) })
    store.sync([point(10, 0)])
    await settle()
    expect(store.get('p')!.status).toBe('ready')
    expect(error).toHaveBeenCalledWith('Inspector computation failed for p:', expect.any(TypeError))
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
    expect(vi.mocked(deps.fetchShapeStatistics).mock.calls[0][1]).toHaveLength(4)
  })

  it('samples elevation over the ground, with the outline only for its extremes', async () => {
    const { store, deps } = setup()
    store.sync([square(10, -70)])
    await settle()
    const [spread, outline] = vi.mocked(deps.sampleElevation).mock.calls[0]
    expect(spread.length).toBeGreaterThan(100)
    expect(outline).toHaveLength(4)
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

  it('reads a shape across 180° with the area of the same box elsewhere', async () => {
    const { store, deps } = setup()
    store.sync([acrossMeridian()])
    await settle()
    expect(deps.fetchShapeStatistics).toHaveBeenCalled()
    expect(store.get('s')!.areaKm2).toBeGreaterThan(0)
    expect(store.get('s')!.areaKm2).toBeLessThan(1e4)
  })

  it('reads a dataset reaching only one side of a shape across 180°', async () => {
    const regional: Record<string, number[]> = { ...BOUNDS, 'global.tif': [-180, -60, -170, 60], 'band.tif': [170, -60, 180, 60] }
    const { store, deps } = setup({ fetchBounds: vi.fn(async (filename: string) => regional[filename]) })
    store.sync([acrossMeridian()])
    await settle()
    expect(vi.mocked(deps.fetchShapeStatistics).mock.calls.map(c => c[0])).toEqual(['global.tif', 'band.tif'])
  })

  it('reads no data for a dataset far from a shape across 180°, whichever way its longitudes run', async () => {
    const regional: Record<string, number[]> = { ...BOUNDS, 'global.tif': [-10, -60, 10, 60], 'band.tif': [-10, -60, 10, 60] }
    const { store, deps } = setup({ fetchBounds: vi.fn(async (filename: string) => regional[filename]) })
    store.sync([acrossMeridian()])
    await settle()
    expect(deps.fetchShapeStatistics).not.toHaveBeenCalled()
    expect(store.get('s')!.lines.global).toMatchObject({ noData: 'outside' })
  })

  it('converts a circle to a polygon', async () => {
    const { store, deps } = setup()
    store.sync([feature('c', 'circle', { center: deg(0, 0), radius: 20_000 })])
    await settle()
    expect(vi.mocked(deps.fetchShapeStatistics).mock.calls[0][1].length).toBeGreaterThan(20)
    expect(store.get('c')!.kind).toBe('shape')
  })

  it('reads a dataset reaching a pole for a ring around it, even when the ring stays off that dataset', async () => {
    const nearPole: Record<string, number[]> = { ...BOUNDS, 'global.tif': [-10, -90, 10, -88], 'band.tif': [-10, 10, 10, 20] }
    const { store, deps } = setup({ fetchBounds: vi.fn(async (filename: string) => nearPole[filename]) })
    store.sync([feature('c', 'circle', { center: deg(40, -87), radius: 200_000 })])
    await settle()
    const read = vi.mocked(deps.fetchShapeStatistics).mock.calls.map(c => c[0])
    expect(read).toContain('global.tif')
    expect(read).not.toContain('band.tif')
    expect(store.get('c')!.lines.band).toMatchObject({ noData: 'outside' })
  })

  it('keeps the value when the catalog item fails', async () => {
    const { store } = setup({ fetchResolution: vi.fn(async () => { throw new Error('no item') }) })
    store.sync([square(10, -70)])
    await settle()
    expect(store.get('s')!.lines.global).toMatchObject({ value: 5, resolutionKm: undefined })
  })

  it('reads no statistics for a shape with no area, whatever its datasets cover', async () => {
    const { store, deps } = setup()
    store.sync([
      feature('meridian', 'polygon', { positions: [deg(40, -60), deg(40, -55), deg(40, -52)] }),
      feature('spot', 'polygon', { positions: [deg(10, 10), deg(10, 10), deg(10, 10)] }),
    ])
    await settle()
    expect(deps.fetchShapeStatistics).not.toHaveBeenCalled()
    for (const id of ['meridian', 'spot']) {
      const result = store.get(id)!
      expect(result).toMatchObject({ status: 'ready', done: 3, failedRequests: 0, elevation: { value: -100 } })
      expect(result.areaKm2).toBeLessThan(MIN_AREA_KM2)
      expect(Object.values(result.lines).map(line => line.noData)).toEqual(['no-area', 'no-area', 'no-area'])
    }
  })

  it('reads a sliver, which holds ground', async () => {
    const { store, deps } = setup()
    store.sync([feature('sliver', 'polygon', { positions: [deg(10, 10), deg(12, 10), deg(12, 10.0001)] })])
    await settle()
    expect(store.get('sliver')!.areaKm2).toBeCloseTo(0.09, 2)
    expect(deps.fetchShapeStatistics).toHaveBeenCalled()
    expect(store.get('sliver')!.lines.global).toMatchObject({ value: 5 })
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

  it('finishes a line under two vertices at once', async () => {
    const { store, deps } = setup()
    store.sync([feature('a', 'line', { positions: [deg(0, 0)] }), feature('b', 'line', {})])
    await settle()
    expect(store.get('a')).toMatchObject({ status: 'ready', lines: {} })
    expect(store.get('b')).toMatchObject({ status: 'ready', lines: {} })
    expect(deps.fetchPointValues).not.toHaveBeenCalled()
  })

  it('sends no request for samples outside every dataset', async () => {
    const { store, deps } = setup({ lines: lines.filter(line => line.id === 'band') })
    store.sync([feature('l', 'line', { positions: [deg(0, 60), deg(0, 70)] })])
    await settle()
    expect(deps.fetchPointValues).not.toHaveBeenCalled()
    expect(store.get('l')!.lines.band).toMatchObject({ noData: 'outside', extent: '50°N to 50°S' })
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

  it('drops a line deleted while its samples are read, without an error', async () => {
    // Earlier tests leave their console.error calls on the shared spy
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    error.mockClear()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const { store } = setup({
      fetchPointValues: vi.fn(async (filenames: string[]) => {
        await gate
        return new Map(filenames.map(f => [f, 1] as [string, number | null]))
      }),
    })
    store.sync([feature('l', 'line', { positions: [deg(0, 40), deg(0, 60)] })])
    await flush()
    store.sync([])
    release()
    await flush()
    expect(store.get('l')).toBeUndefined()
    expect(error).not.toHaveBeenCalled()
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
