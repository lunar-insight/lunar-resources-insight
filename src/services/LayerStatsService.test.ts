import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CogStatistics } from 'geoConfigExporter'

const fetchCogStatistics = vi.fn<(filename: string) => Promise<CogStatistics>>()

vi.mock('../geoConfigExporter', () => ({
  fetchCogStatistics: (filename: string) => fetchCogStatistics(filename),
  layersConfig: {
    layers: {
      basemap: { filename: 'basemap.tif', category: 'basemap' },
      names: { filename: 'names.json', category: 'geographical', layerType: 'vector' },
      hidden: { filename: 'hidden.tif', category: 'geographical', available: false },
      thorium: {
        filename: 'th_fine.tif',
        category: 'chemical',
        variants: [
          { label: 'fine', filename: 'th_fine.tif', stac: 'fine.json' },
          { label: 'coarse', filename: 'th_coarse.tif', stac: 'coarse.json' },
        ],
      },
      iron: { filename: 'fe.tif', category: 'chemical' },
    },
  },
}))

import {
  LayerStatsService,
  continuousPercentilePosition,
  classifyGeochemicalStats,
  defaultFileOf,
  type LayerStats,
} from './LayerStatsService'

const band = (overrides: Partial<NonNullable<CogStatistics['b1']>> = {}): CogStatistics => ({
  b1: {
    min: 0, max: 100, mean: 50, std: 10, median: 50, count: 1, sum: 1,
    histogram: [[1], [0, 100]],
    percentile_2: 2, percentile_15: 15, percentile_85: 85, percentile_95: 95, percentile_98: 98,
    majority: 0, minority: 0, unique: 1, valid_percent: 100, masked_pixels: 0, valid_pixels: 1,
    ...overrides,
  },
})

// fetchCogStatistics reports a failure as a response without b1
const failure: CogStatistics = { min: 0, max: 100, mean: 50, std: 0, median: 50 }

const stats = (overrides: Partial<LayerStats>): LayerStats => ({
  min: 0, max: 100,
  percentile_2: 2, percentile_15: 15, percentile_85: 85, percentile_95: 95, percentile_98: 98,
  loaded: true,
  ...overrides,
})

describe('continuousPercentilePosition', () => {
  it('interpolates between the percentiles', () => {
    expect(continuousPercentilePosition(stats({}), 50)).toBeCloseTo(0.5)
    expect(continuousPercentilePosition(stats({}), 90)).toBeCloseTo(0.9)
  })

  it('places a value between p2 = 0 and p15 between 0.02 and 0.15', () => {
    const position = continuousPercentilePosition(stats({ percentile_2: 0, percentile_15: 10 }), 5)
    expect(position).toBeGreaterThan(0.02)
    expect(position).toBeLessThan(0.15)
  })

  it('places a value above p2 = p15 = 0 above 0.15', () => {
    const position = continuousPercentilePosition(stats({ percentile_2: 0, percentile_15: 0 }), 3)
    expect(position).toBeGreaterThan(0.15)
    expect(position).toBeLessThan(0.85)
  })

  it('clamps values outside the minimum and maximum', () => {
    expect(continuousPercentilePosition(stats({ min: 10 }), 5)).toBe(0)
    expect(continuousPercentilePosition(stats({}), 120)).toBe(1)
  })

  it('returns the default when a percentile is missing or not loaded', () => {
    expect(continuousPercentilePosition(stats({ percentile_15: undefined }), 50)).toBe(0.5)
    expect(continuousPercentilePosition(stats({ loaded: false }), 50)).toBe(0.5)
  })
})

describe('classifyGeochemicalStats', () => {
  it('names each band', () => {
    const s = stats({})
    expect(classifyGeochemicalStats(s, 1)).toBe('highly-depleted')
    expect(classifyGeochemicalStats(s, 10)).toBe('depleted')
    expect(classifyGeochemicalStats(s, 50)).toBe('background')
    expect(classifyGeochemicalStats(s, 90)).toBe('enriched')
    expect(classifyGeochemicalStats(s, 96)).toBe('highly-enriched')
    expect(classifyGeochemicalStats(s, 99)).toBe('anomalous')
  })

  it('treats p2 = 0 as a value', () => {
    expect(classifyGeochemicalStats(stats({ percentile_2: 0, percentile_15: 10 }), 5)).toBe('depleted')
  })

  it('classifies with p2 = p15 = 0', () => {
    const s = stats({ percentile_2: 0, percentile_15: 0 })
    expect(classifyGeochemicalStats(s, 3)).toBe('background')
    expect(classifyGeochemicalStats(s, 0)).toBe('highly-depleted')
  })

  it('returns the default when a percentile is missing', () => {
    expect(classifyGeochemicalStats(stats({ percentile_98: undefined }), 99)).toBe('background')
  })
})

describe('defaultFileOf', () => {
  it('reads the first variant', () => {
    expect(defaultFileOf({
      filename: 'a.tif', category: 'chemical',
      variants: [{ label: 'x', filename: 'b.tif', stac: 'b.json' }],
    })).toBe('b.tif')
    expect(defaultFileOf({ filename: 'a.tif', category: 'chemical' })).toBe('a.tif')
  })
})

describe('LayerStatsService', () => {
  let service: LayerStatsService

  beforeEach(() => {
    fetchCogStatistics.mockReset()
    service = new LayerStatsService(0)
  })

  it('fetches each default file once at start, skipping vector and unavailable layers', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await service.initialize()

    expect(fetchCogStatistics.mock.calls.map(([f]) => f).sort())
      .toEqual(['basemap.tif', 'fe.tif', 'th_fine.tif'])
    expect(service.isInitialized()).toBe(true)
    expect(service.getLayerStats('thorium').loaded).toBe(true)
  })

  it('stores statistics by file, so two variants of one layer keep their own', async () => {
    fetchCogStatistics.mockImplementation(async f => band({ max: f === 'th_fine.tif' ? 10 : 20 }))
    await service.initialize()
    await service.setActiveFile('thorium', 'th_coarse.tif')

    expect(service.getFileStats('th_fine.tif').max).toBe(10)
    expect(service.getFileStats('th_coarse.tif').max).toBe(20)
    expect(service.getLayerStats('thorium').max).toBe(20)
  })

  it('needs no request when switching back to a variant already read', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await service.initialize()
    await service.setActiveFile('thorium', 'th_coarse.tif')
    await service.setActiveFile('thorium', 'th_fine.tif')

    expect(fetchCogStatistics.mock.calls.filter(([f]) => f === 'th_fine.tif')).toHaveLength(1)
    expect(service.fileFor('thorium')).toBe('th_fine.tif')
  })

  it('keeps the previous file in use until the new one is fetched', async () => {
    fetchCogStatistics.mockResolvedValue(band({ max: 10 }))
    await service.initialize()

    let release!: (value: CogStatistics) => void
    fetchCogStatistics.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    const switching = service.setActiveFile('thorium', 'th_coarse.tif')

    expect(service.getLayerStats('thorium').max).toBe(10)
    release(band({ max: 20 }))
    await switching
    expect(service.getLayerStats('thorium').max).toBe(20)
  })

  it('applies the last of two overlapping switches', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await service.initialize()

    let release!: (value: CogStatistics) => void
    fetchCogStatistics.mockReturnValueOnce(new Promise(resolve => { release = resolve }))
    const first = service.setActiveFile('thorium', 'th_coarse.tif')
    await service.setActiveFile('thorium', 'th_fine.tif')
    release(band())
    await first

    expect(service.fileFor('thorium')).toBe('th_fine.tif')
  })

  it('returns to the default file once cleared', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await service.setActiveFile('thorium', 'th_coarse.tif')
    service.clearActiveFile('thorium')
    expect(service.fileFor('thorium')).toBe('th_fine.tif')
  })

  it('retries a failed file once before marking it not loaded', async () => {
    fetchCogStatistics.mockResolvedValueOnce(failure).mockResolvedValueOnce(band())
    const result = await service.ensureFileStats('fe.tif')

    expect(fetchCogStatistics).toHaveBeenCalledTimes(2)
    expect(result.loaded).toBe(true)
  })

  it('marks a file not loaded after the retry also fails', async () => {
    fetchCogStatistics.mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await service.ensureFileStats('fe.tif')

    expect(fetchCogStatistics).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ min: 0, max: 100, loaded: false })
    expect(service.isFileLoaded('fe.tif')).toBe(false)
  })

  it('shares one request between simultaneous callers', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await Promise.all([service.ensureFileStats('fe.tif'), service.ensureFileStats('fe.tif')])
    expect(fetchCogStatistics).toHaveBeenCalledTimes(1)
  })

  it('retries only the missing files', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchCogStatistics.mockImplementation(async f => (f === 'fe.tif' ? failure : band()))
    await service.initialize()
    fetchCogStatistics.mockClear()
    fetchCogStatistics.mockResolvedValue(band())

    await service.retryMissing(['fe.tif', 'th_fine.tif', 'fe.tif'])

    expect(fetchCogStatistics.mock.calls).toEqual([['fe.tif']])
    expect(service.isFileLoaded('fe.tif')).toBe(true)
  })

  it('notifies subscribers when a file is stored, until unsubscribed', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    const listener = vi.fn()
    const unsubscribe = service.subscribe(listener)

    await service.ensureFileStats('fe.tif')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    await service.ensureFileStats('basemap.tif')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reads layer positions and classes from the file the map shows', async () => {
    fetchCogStatistics.mockResolvedValue(band())
    await service.initialize()
    expect(service.calculateContinuousPercentilePosition('iron', 50)).toBeCloseTo(0.5)
    expect(service.classifyGeochemicalValue('iron', 99)).toBe('anomalous')
    expect(service.getLayerStats('unknown').loaded).toBe(false)
  })
})
