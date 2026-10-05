import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Cesium from 'cesium'

const terrain = vi.hoisted(() => ({
  provider: null as unknown,
  sampleTerrainHeights: vi.fn(),
}))

vi.mock('services/TerrainService', () => ({
  TerrainService: {
    getTerrainProvider: () => terrain.provider,
    sampleTerrainHeights: terrain.sampleTerrainHeights,
  },
}))

const stac = vi.hoisted(() => ({ fetchStacItem: vi.fn() }))
vi.mock('services/StacService', () => ({ stacService: stac }))

import {
  fetchFileBounds,
  fetchPointValues,
  fetchResolutionKm,
  fetchShapeStatistics,
  resetInspectorRequestCaches,
  sampleElevation,
  PointRequestError,
} from './inspectorRequests'

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, statusText: String(status), json: async () => body }) as Response

const fetchMock = vi.fn<(input: string, init?: RequestInit) => Promise<Response>>()

beforeEach(() => {
  resetInspectorRequestCaches()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchPointValues', () => {
  it('reads every file in one request and maps values back by asset', async () => {
    fetchMock.mockImplementation(async url => {
      if (url.includes('assets.json')) return json({ assets: ['iron5d', 'feo_clementine'] })
      return json({ band_descriptions: ['iron5d', 'feo_clementine'], values: [6.2, null] })
    })

    const values = await fetchPointValues(['a/iron5d_COG.tif', 'b/feo_clementine_COG.tif', 'a/iron5d_COG.tif'], { lon: 3, lat: 26 })

    expect(values).toEqual(new Map([['a/iron5d_COG.tif', 6.2], ['b/feo_clementine_COG.tif', null]]))
    const pointCall = fetchMock.mock.calls.find(([url]) => url.includes('/stac/point/'))![0]
    expect(pointCall).toContain('/stac/point/3,26')
    expect(pointCall).toContain('assets=iron5d&assets=feo_clementine')
    expect(pointCall).toContain('coord_crs=IAU%3A30100')
  })

  it('sends no request for no files', async () => {
    expect(await fetchPointValues([], { lon: 0, lat: 0 })).toEqual(new Map())
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails on a file the index does not hold', async () => {
    fetchMock.mockResolvedValue(json({ assets: ['iron5d'] }))
    await expect(fetchPointValues(['x/other.tif'], { lon: 0, lat: 0 })).rejects.toBeInstanceOf(PointRequestError)
  })

  it('retries a failed request once', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    let pointCalls = 0
    fetchMock.mockImplementation(async url => {
      if (url.includes('assets.json')) return json({}, 500)
      return ++pointCalls === 1 ? json({}, 502) : json({ band_names: ['iron5d'], values: [1] })
    })
    expect(await fetchPointValues(['iron5d.tif'], { lon: 0, lat: 0 })).toEqual(new Map([['iron5d.tif', 1]]))
    expect(pointCalls).toBe(2)
  })

  it('fails after the retry fails too', async () => {
    fetchMock.mockImplementation(async url => (url.includes('assets.json') ? json({ assets: ['iron5d'] }) : json({}, 502)))
    await expect(fetchPointValues(['iron5d.tif'], { lon: 0, lat: 0 })).rejects.toThrow('HTTP 502')
  })
})

describe('fetchShapeStatistics', () => {
  const geojson = { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [] as number[][][] } }

  it('posts the shape with the Moon CRS, the read cap and two percentiles', async () => {
    fetchMock.mockResolvedValue(json({
      properties: { statistics: { b1: {
        mean: 4.75, median: 4.8, std: 0.44, min: 3.6, max: 7.2, count: 576,
        valid_percent: 100, percentile_15: 4.4, percentile_85: 5,
      } } },
    }))

    const stats = await fetchShapeStatistics('chemical_elements/th.tif', geojson)

    expect(stats).toEqual({ mean: 4.75, median: 4.8, std: 0.44, min: 3.6, max: 7.2, p15: 4.4, p85: 5, count: 576, coverage: 100 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe('POST')
    expect(JSON.parse(init?.body as string)).toEqual(geojson)
    const params = new URL(url, 'http://host').searchParams
    expect(params.get('coord_crs')).toBe('IAU_2015:30100')
    expect(params.get('max_size')).toBe('1024')
    expect(params.getAll('p')).toEqual(['15', '85'])
    expect(params.get('url')).toMatch(/chemical_elements\/th\.tif$/)
  })

  it('returns null for a shape holding no data', async () => {
    fetchMock.mockResolvedValue(json({ properties: { statistics: { b1: { mean: null, count: 0, valid_percent: 0 } } } }))
    expect(await fetchShapeStatistics('f.tif', geojson)).toBeNull()
  })

  it('does not retry an aborted request', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(async () => {
      controller.abort()
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(fetchShapeStatistics('f.tif', geojson, controller.signal)).rejects.toThrow('aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('fetchFileBounds', () => {
  it('reads bounds once per file', async () => {
    fetchMock.mockResolvedValue(json({ bounds: [-180, -50, 180, 50], crs: 'GEOGCS["Moon"]' }))
    expect(await fetchFileBounds('mi.tif')).toEqual([-180, -50, 180, 50])
    expect(await fetchFileBounds('mi.tif')).toEqual([-180, -50, 180, 50])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('forgets a failed read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json({ bounds: [0, 0, 1, 1] }))
    await expect(fetchFileBounds('x.tif')).rejects.toThrow()
    expect(await fetchFileBounds('x.tif')).toEqual([0, 0, 1, 1])
  })
})

describe('fetchResolutionKm', () => {
  it('reads lri:resolution_km from the catalog item', async () => {
    stac.fetchStacItem.mockResolvedValueOnce({ properties: { 'lri:resolution_km': 45 } })
    expect(await fetchResolutionKm('item.json')).toBe(45)
    stac.fetchStacItem.mockResolvedValueOnce(null)
    expect(await fetchResolutionKm('missing.json')).toBeUndefined()
    expect(await fetchResolutionKm(undefined)).toBeUndefined()
  })
})

describe('sampleElevation', () => {
  it('has no elevation without terrain tiles', async () => {
    terrain.provider = null
    expect(await sampleElevation([{ lon: 0, lat: 0 }])).toBeNull()
  })

  it('averages sampled heights', async () => {
    terrain.provider = Object.create(Cesium.CesiumTerrainProvider.prototype)
    terrain.sampleTerrainHeights.mockImplementation(async (positions: Cesium.Cartographic[]) =>
      positions.map((p, i) => {
        const sampled = new Cesium.Cartographic(p.longitude, p.latitude)
        sampled.height = [-300, 100, undefined as unknown as number][i]
        return sampled
      }))
    expect(await sampleElevation([{ lon: 0, lat: 0 }, { lon: 1, lat: 0 }, { lon: 2, lat: 0 }]))
      .toEqual({ value: -100, lowest: -300, highest: 100 })
    expect(await sampleElevation([])).toBeNull()
  })

  it('has no elevation when no height was sampled', async () => {
    terrain.provider = Object.create(Cesium.CesiumTerrainProvider.prototype)
    terrain.sampleTerrainHeights.mockImplementation(async (positions: Cesium.Cartographic[]) =>
      positions.map(p => new Cesium.Cartographic(p.longitude, p.latitude, NaN)))
    expect(await sampleElevation([{ lon: 0, lat: 0 }])).toBeNull()
  })
})
