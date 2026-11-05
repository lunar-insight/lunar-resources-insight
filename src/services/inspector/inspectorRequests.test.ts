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
  fetchClippedRange,
  fetchFileBounds,
  fetchFilePixelKm,
  fetchPicture,
  fetchPointValues,
  fetchResolutionKm,
  fetchShapeStatistics,
  resetInspectorRequestCaches,
  sampleElevation,
  PointRequestError,
} from './inspectorRequests'
import { circleRing, localShape, shapeParts } from './featureGeometry'
import { localCrs } from './pictureGeometry'

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

describe('fetchFilePixelKm', () => {
  const KM_PER_DEGREE = (Math.PI * 1737400) / 180 / 1000

  it('converts degrees on a geographic file, once per file', async () => {
    fetchMock.mockResolvedValue(json({ bounds: [-180, -65, 180, 65], width: 184320, crs: 'GEOGCS["Moon"]' }))
    await expect(fetchFilePixelKm('a.tif')).resolves.toBeCloseTo((360 / 184320) * KM_PER_DEGREE, 8)
    await fetchFilePixelKm('a.tif')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('converts meters on a projected file', async () => {
    fetchMock.mockResolvedValue(json({ bounds: [-1267472, -1267472, 1267472, 1267472], width: 2529, crs: 'PROJCS["Moon"]' }))
    await expect(fetchFilePixelKm('polar.tif')).resolves.toBeCloseTo(1.0024, 3)
  })

  it('asks again after a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockResolvedValueOnce(json({}, 500))
    await expect(fetchFilePixelKm('a.tif')).rejects.toThrow()
    fetchMock.mockResolvedValueOnce(json({ bounds: [0, 0, 1, 1], width: 1, crs: 'GEOGCS["Moon"]' }))
    await expect(fetchFilePixelKm('a.tif')).resolves.toBeCloseTo(KM_PER_DEGREE, 6)
  })
})

describe('fetchPicture', () => {
  const part = (x0: number, x1: number, width: number) => ({ x0, y0: -10, x1, y1: 10, width, height: 300 })
  const center = { lon: 50.27, lat: -64.25 }
  const whole = { center, x0: -20, y0: -10, x1: 20, y1: 10, parts: [part(-20, 20, 422)] }
  const split = {
    center: { lon: 180, lat: 2 },
    x0: -100, y0: -10, x1: 100, y1: 10,
    parts: [part(-100, -5, 200), part(5, 100, 222)],
  }

  // Each decoded image is filled with its width as gray, and half its width as alpha
  beforeEach(() => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ close: vi.fn() })))
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (this: HTMLCanvasElement) {
      const { width, height } = this
      return {
        drawImage: vi.fn(),
        getImageData: () => {
          const data = new Uint8ClampedArray(width * height * 4)
          for (let i = 0; i < width * height; i++) {
            data[i * 4] = width % 256
            data[i * 4 + 3] = (width / 2) % 256
          }
          return { data }
        },
      } as unknown as CanvasRenderingContext2D
    } as unknown as typeof HTMLCanvasElement.prototype.getContext)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const png = () => ({ ok: true, status: 200, blob: async () => new Blob() }) as Response

  it('asks for the box in a local projection, with the rescale', async () => {
    fetchMock.mockResolvedValue(png())
    await fetchPicture('compounds/feo.tif', whole, [0, 24])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = fetchMock.mock.calls[0][0]
    expect(url).toContain('/cog/bbox/-20,-10,20,10/422x300.png?')
    const params = new URL(url, 'http://x').searchParams
    expect(params.get('url')).toBe('/data/compounds/feo.tif')
    expect(params.get('bidx')).toBe('1')
    expect(params.get('rescale')).toBe('0,24')
    expect(params.get('coord_crs')).toBe(localCrs(center))
    expect(params.get('dst_crs')).toBe(localCrs(center))
    // The + of the projection text reaches the tiler as a plus, not as a space
    expect(url).toContain('coord_crs=%2Bproj%3Dlaea')
  })

  it('decodes with no color conversion and no premultiplied alpha', async () => {
    fetchMock.mockResolvedValue(png())
    await fetchPicture('a.tif', whole, [0, 24])
    expect(createImageBitmap).toHaveBeenCalledWith(expect.any(Blob), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' })
  })

  it('sends no rescale without a range', async () => {
    fetchMock.mockResolvedValue(png())
    await fetchPicture('a.tif', whole, null)
    expect(fetchMock.mock.calls[0][0]).not.toContain('rescale')
  })

  it('gives one part as 422 × 300 gray and alpha', async () => {
    fetchMock.mockResolvedValue(png())
    const { gray, alpha } = await fetchPicture('a.tif', whole, [0, 24])
    expect(gray).toHaveLength(422 * 300)
    expect(gray.every(value => value === 422 % 256)).toBe(true)
    expect(alpha.every(value => value === 211)).toBe(true)
  })

  it('composes two parts side by side, with their own widths', async () => {
    fetchMock.mockResolvedValue(png())
    const { gray, alpha } = await fetchPicture('a.tif', split, [0, 24])

    expect(fetchMock.mock.calls.map(call => call[0].split('?')[0])).toEqual([
      '/cog/bbox/-100,-10,-5,10/200x300.png',
      '/cog/bbox/5,-10,100,10/222x300.png',
    ])
    for (const row of [0, 150, 299]) {
      expect(gray[row * 422]).toBe(200)
      expect(gray[row * 422 + 199]).toBe(200)
      expect(gray[row * 422 + 200]).toBe(222)
      expect(gray[row * 422 + 421]).toBe(222)
      expect(alpha[row * 422 + 199]).toBe(100)
      expect(alpha[row * 422 + 200]).toBe(111)
    }
  })

  it('retries a failed request once', async () => {
    fetchMock.mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(png())
    await fetchPicture('a.tif', whole, [0, 24])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails after its retry', async () => {
    fetchMock.mockResolvedValue(json({}, 500))
    await expect(fetchPicture('a.tif', whole, [0, 24])).rejects.toThrow('HTTP 500')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry once aborted', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(async () => {
      controller.abort()
      throw new Error('aborted')
    })
    await expect(fetchPicture('a.tif', whole, [0, 24], controller.signal)).rejects.toThrow('aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
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

  it('fails every file when the asset list names no assets', async () => {
    fetchMock.mockResolvedValue(json({}))
    await expect(fetchPointValues(['a/iron5d_COG.tif'], { lon: 0, lat: 0 })).rejects.toThrow('does not hold a/iron5d_COG.tif')
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

  it('reads no data for every file when the response names no bands', async () => {
    fetchMock.mockImplementation(async url => (url.includes('assets.json') ? json({ assets: ['iron5d', 'feo'] }) : json({})))
    expect(await fetchPointValues(['iron5d.tif', 'feo.tif'], { lon: 0, lat: 0 }))
      .toEqual(new Map([['iron5d.tif', null], ['feo.tif', null]]))
  })
})

describe('fetchShapeStatistics', () => {
  const ring = [{ lon: 10, lat: 10 }, { lon: 11, lat: 10 }, { lon: 11, lat: 11 }, { lon: 10, lat: 11 }]

  it('posts the shape in its local projection, with the read cap and two percentiles', async () => {
    fetchMock.mockResolvedValue(json({
      properties: { statistics: { b1: {
        mean: 4.75, median: 4.8, std: 0.44, min: 3.6, max: 7.2, count: 576,
        valid_percent: 100, percentile_15: 4.4, percentile_85: 5,
        histogram: [[400, 176], [3.6, 5.4, 7.2]],
      } } },
    }))

    const stats = await fetchShapeStatistics('chemical_elements/th.tif', ring)

    expect(stats).toEqual({
      mean: 4.75, median: 4.8, std: 0.44, min: 3.6, max: 7.2, p15: 4.4, p85: 5, count: 576, coverage: 100,
      histogram: { counts: [400, 176], edges: [3.6, 5.4, 7.2] },
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(init?.method).toBe('POST')
    const { crs, geojson } = localShape(ring)
    expect(JSON.parse(init?.body as string)).toEqual(geojson)
    const params = new URL(url, 'http://host').searchParams
    expect(params.get('coord_crs')).toBe(crs)
    expect(params.get('dst_crs')).toBe(crs)
    expect(params.get('max_size')).toBe('1024')
    expect(params.getAll('p')).toEqual(['15', '85'])
    expect(params.get('histogram_bins')).toBe('12')
    expect(params.get('url')).toMatch(/chemical_elements\/th\.tif$/)
  })

  it('drops a histogram that is not counts and one more edge', async () => {
    const b1 = { mean: 5, median: 5, std: 1, min: 3, max: 7, count: 10, valid_percent: 100, percentile_15: 4, percentile_85: 6 }
    for (const histogram of [[[1, 2], [3, 7]], [[1, 'x'], [3, 5, 7]], [[], [3]], 'none', [[1, 2]]]) {
      fetchMock.mockResolvedValueOnce(json({ properties: { statistics: { b1: { ...b1, histogram } } } }))
      expect(await fetchShapeStatistics('f.tif', ring)).not.toHaveProperty('histogram')
    }
  })

  it('returns null for a shape holding no data', async () => {
    fetchMock.mockResolvedValue(json({ properties: { statistics: { b1: { mean: null, count: 0, valid_percent: 0 } } } }))
    expect(await fetchShapeStatistics('f.tif', ring)).toBeNull()
  })

  it('retries a failed request once', async () => {
    fetchMock
      .mockResolvedValueOnce(json({}, 502))
      .mockResolvedValueOnce(json({ properties: { statistics: { b1: {
        mean: 5, median: 5, std: 1, min: 3, max: 7, count: 10, valid_percent: 100, percentile_15: 4, percentile_85: 6,
      } } } }))
    expect(await fetchShapeStatistics('f.tif', ring)).toMatchObject({ mean: 5, coverage: 100 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('fails after the retry fails too', async () => {
    fetchMock.mockResolvedValue(json({}, 502))
    await expect(fetchShapeStatistics('f.tif', ring)).rejects.toThrow('HTTP 502')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry an aborted request', async () => {
    const controller = new AbortController()
    fetchMock.mockImplementation(async () => {
      controller.abort()
      throw new DOMException('aborted', 'AbortError')
    })
    await expect(fetchShapeStatistics('f.tif', ring, controller.signal)).rejects.toThrow('aborted')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  describe('a shape at 180°', () => {
    const crossing = [{ lon: 179.5, lat: -1 }, { lon: -179.5, lat: -1 }, { lon: -179.5, lat: 1 }, { lon: 179.5, lat: 1 }]
    const large = circleRing({ lon: 180, lat: 0 }, 300_000)
    const WIDE = { bounds: [-180, -65, 180, 65], width: 184320, crs: 'GEOGCS["Moon"]' }
    const b1 = (mean: number, min: number, max: number, histogram?: [number[], number[]], valid = 100) => ({
      properties: { statistics: { b1: {
        mean, median: mean, std: 1, min, max, count: 100, valid_percent: valid, percentile_15: min, percentile_85: max,
        ...(histogram ? { histogram } : {}),
      } } },
    })
    const fine = (bin: number): [number[], number[]] => [
      Array.from({ length: 1200 }, (_, i) => (i === bin ? 100 : 0)),
      Array.from({ length: 1201 }, (_, i) => 2 + (i * 6) / 1200),
    ]
    const search = (call: number) => new URL(fetchMock.mock.calls[call][0], 'http://host').searchParams
    const body = (call: number) => JSON.parse(fetchMock.mock.calls[call][1]?.body as string)

    it('reads a wide global file in two parts of its own grid, and merges them', async () => {
      fetchMock
        .mockResolvedValueOnce(json(WIDE))
        .mockResolvedValueOnce(json(b1(4, 2, 5)))
        .mockResolvedValueOnce(json(b1(6, 5, 8)))
        .mockResolvedValueOnce(json(b1(4, 2, 5, fine(300))))
        .mockResolvedValueOnce(json(b1(6, 5, 8, fine(900))))

      const stats = await fetchShapeStatistics('wide-both.tif', crossing)

      expect(stats).toMatchObject({ mean: 5, min: 2, max: 8, count: 200, coverage: 100 })
      expect(stats!.histogram!.counts).toHaveLength(12)
      expect(fetchMock).toHaveBeenCalledTimes(5)
      expect(search(1).get('coord_crs')).toBe('IAU_2015:30100')
      expect(search(1).has('dst_crs')).toBe(false)
      expect(search(1).get('histogram_bins')).toBe('12')
      expect(body(1)).toEqual(shapeParts(crossing)[0].geojson)
      expect(body(2)).toEqual(shapeParts(crossing)[1].geojson)
      expect(search(3).get('histogram_bins')).toBe('1200')
      expect(search(3).get('histogram_range')).toBe('2,8')
      expect(search(4).get('histogram_range')).toBe('2,8')
      expect(body(4)).toEqual(shapeParts(crossing)[1].geojson)
    })

    it('reads the file once for all shapes', async () => {
      fetchMock
        .mockResolvedValueOnce(json(WIDE))
        .mockResolvedValue(json({ properties: { statistics: { b1: { mean: null, count: 0, valid_percent: 0 } } } }))
      await fetchShapeStatistics('wide-once.tif', crossing)
      const calls = fetchMock.mock.calls.length
      await fetchShapeStatistics('wide-once.tif', crossing)
      expect(fetchMock.mock.calls.length).toBe(calls + 2)
      expect(fetchMock.mock.calls.filter(([url]) => url.includes('/cog/info'))).toHaveLength(1)
    })

    it('returns null when neither part holds data', async () => {
      fetchMock
        .mockResolvedValueOnce(json(WIDE))
        .mockResolvedValue(json({ properties: { statistics: { b1: { mean: null, count: 0, valid_percent: 0 } } } }))
      expect(await fetchShapeStatistics('wide-empty.tif', crossing)).toBeNull()
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('keeps the statistics of the one part holding data, with coverage over the whole shape', async () => {
      fetchMock
        .mockResolvedValueOnce(json(WIDE))
        .mockResolvedValueOnce(json({ properties: { statistics: { b1: { mean: null, count: 0, valid_percent: 0 } } } }))
        .mockResolvedValueOnce(json(b1(6, 5, 8, [[100], [5, 8]], 80)))
      const stats = await fetchShapeStatistics('wide-one.tif', crossing)
      expect(stats).toMatchObject({ mean: 6, min: 5, max: 8 })
      expect(stats!.coverage).toBeCloseTo(40, 3)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('fails a merge when a part returns no histogram', async () => {
      fetchMock
        .mockResolvedValueOnce(json(WIDE))
        .mockResolvedValueOnce(json(b1(4, 2, 5)))
        .mockResolvedValueOnce(json(b1(6, 5, 8)))
        .mockResolvedValue(json(b1(4, 2, 5)))
      await expect(fetchShapeStatistics('wide-nohist.tif', crossing)).rejects.toThrow('No histogram')
    })

    it('reads a coarse file in one local request', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ bounds: [-180, -90, 180, 90], width: 720, crs: 'GEOGCS["Moon"]' }))
        .mockResolvedValueOnce(json(b1(4, 2, 5)))
      expect(await fetchShapeStatistics('coarse.tif', crossing)).toMatchObject({ mean: 4 })
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(search(1).get('dst_crs')).toBe(localShape(crossing).crs)
    })

    it('reads a polar file in one local request, as its grid has no seam at 180°', async () => {
      fetchMock
        .mockResolvedValueOnce(json({ bounds: [-1267472, -1267472, 1267472, 1267472], width: 25290, crs: 'PROJCS["Moon"]' }))
        .mockResolvedValueOnce(json(b1(4, 2, 5)))
      expect(await fetchShapeStatistics('polar.tif', crossing)).toMatchObject({ mean: 4 })
      expect(search(1).get('dst_crs')).toBe(localShape(crossing).crs)
    })

    it('reads a large shape in one local request without asking for the file', async () => {
      fetchMock.mockResolvedValueOnce(json(b1(4, 2, 5)))
      expect(await fetchShapeStatistics('wide-large.tif', large)).toMatchObject({ mean: 4 })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(search(0).get('dst_crs')).toBe(localShape(large).crs)
    })

    it('asks for no file info for a shape away from 180°', async () => {
      fetchMock.mockResolvedValueOnce(json(b1(4, 2, 5)))
      await fetchShapeStatistics('wide-away.tif', ring)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })
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

describe('fetchClippedRange', () => {
  it('reads the clipped range, longitudes and notes from the catalog item', async () => {
    stac.fetchStacItem.mockResolvedValueOnce({ properties: {
      'lri:clipped_range': [0, 24],
      'lri:clipped_longitudes': [-180, 60],
      'lri:clipped_notes': { high: 'Artifacts.' },
    } })
    expect(await fetchClippedRange('feo.json')).toEqual({ range: [0, 24], longitudes: [-180, 60], notes: { high: 'Artifacts.' } })
  })

  it('reads a range alone', async () => {
    stac.fetchStacItem.mockResolvedValueOnce({ properties: { 'lri:clipped_range': [5, 33] } })
    expect(await fetchClippedRange('al2o3.json')).toEqual({ range: [5, 33] })
  })

  it('drops malformed longitudes and notes but keeps the range', async () => {
    stac.fetchStacItem.mockResolvedValueOnce({ properties: {
      'lri:clipped_range': [0, 24],
      'lri:clipped_longitudes': [-180, '60'],
      'lri:clipped_notes': 'Artifacts.',
    } })
    expect(await fetchClippedRange('a.json')).toEqual({ range: [0, 24] })

    stac.fetchStacItem.mockResolvedValueOnce({ properties: {
      'lri:clipped_range': [0, 24],
      'lri:clipped_longitudes': [-180, 0, 60],
      'lri:clipped_notes': { low: 3, high: 'Artifacts.' },
    } })
    expect(await fetchClippedRange('b.json')).toEqual({ range: [0, 24], notes: { low: undefined, high: 'Artifacts.' } })

    stac.fetchStacItem.mockResolvedValueOnce({ properties: { 'lri:clipped_range': [0, 24], 'lri:clipped_notes': null } })
    expect(await fetchClippedRange('c.json')).toEqual({ range: [0, 24] })
  })

  it('has no clipping without a valid range', async () => {
    stac.fetchStacItem.mockResolvedValueOnce({ properties: { 'lri:clipped_range': [0] } })
    expect(await fetchClippedRange('bad.json')).toBeUndefined()
    stac.fetchStacItem.mockResolvedValueOnce({ properties: {} })
    expect(await fetchClippedRange('plain.json')).toBeUndefined()
    stac.fetchStacItem.mockResolvedValueOnce(null)
    expect(await fetchClippedRange('missing.json')).toBeUndefined()
    expect(await fetchClippedRange(undefined)).toBeUndefined()
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

  describe('with an outline', () => {
    const heightsInOrder = (heights: number[]) => {
      terrain.provider = Object.create(Cesium.CesiumTerrainProvider.prototype)
      terrain.sampleTerrainHeights.mockImplementation(async (positions: Cesium.Cartographic[]) =>
        positions.map((p, i) => {
          const sampled = new Cesium.Cartographic(p.longitude, p.latitude)
          sampled.height = heights[i]
          return sampled
        }))
    }
    const place = (lon: number) => ({ lon, lat: 0 })

    it('averages the points spread over the ground, with extremes from the outline too', async () => {
      heightsInOrder([10, 20, 900, -900])
      expect(await sampleElevation([place(0), place(1)], [place(2), place(3)]))
        .toEqual({ value: 15, lowest: -900, highest: 900 })
    })

    it('averages the outline when no point fell inside the shape', async () => {
      heightsInOrder([4, 8])
      expect(await sampleElevation([], [place(2), place(3)])).toEqual({ value: 6, lowest: 4, highest: 8 })
    })

    it('averages the outline when no point inside has a height', async () => {
      heightsInOrder([NaN, 4, 8])
      expect(await sampleElevation([place(0)], [place(2), place(3)])).toEqual({ value: 6, lowest: 4, highest: 8 })
    })
  })

  it('has no elevation when no height was sampled', async () => {
    terrain.provider = Object.create(Cesium.CesiumTerrainProvider.prototype)
    terrain.sampleTerrainHeights.mockImplementation(async (positions: Cesium.Cartographic[]) =>
      positions.map(p => new Cesium.Cartographic(p.longitude, p.latitude, NaN)))
    expect(await sampleElevation([{ lon: 0, lat: 0 }])).toBeNull()
  })
})
