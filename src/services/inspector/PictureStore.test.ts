// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as Cesium from 'cesium'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import { layersConfig } from 'geoConfigExporter'
import { layerStatsService } from 'services/LayerStatsService'
import { PICTURES_KEPT, PictureStore, pictureKey, type PictureDependencies } from './PictureStore'
import { RequestQueue } from './RequestQueue'
import { InspectorStore, defaultDependencies } from './InspectorStore'

const deg = (lon: number, lat: number) => Cesium.Cartographic.fromDegrees(lon, lat)

const feature = (id: string, type: Feature['type'], metadata: Partial<Feature['metadata']>): Feature => ({
  id, type, name: id, entity: {} as Cesium.Entity, color: '#fff',
  metadata: { createdAt: new Date(0), ...metadata },
  inspectorOpen: false, visible: true,
})

const point = (id = 'p', lon = 30, lat = 10) => feature(id, 'point', { position: deg(lon, lat) })
const polygon = (id = 's') => feature(id, 'polygon', { positions: [deg(10, 10), deg(11, 10), deg(11, 11), deg(10, 11)] })
const file = { layerId: 'feo', filename: 'feo.tif' }
const pixels = { gray: new Uint8Array(1), alpha: new Uint8Array(1) }

const flush = () => new Promise(resolve => setTimeout(resolve, 0))

function setup(overrides: Partial<PictureDependencies> = {}) {
  const queue = new RequestQueue(4)
  const deps: PictureDependencies = {
    fetchPicture: vi.fn(async () => pixels),
    fetchFilePixelKm: vi.fn(async () => 1),
    fetchMoonRange: vi.fn(async (): Promise<[number, number]> => [0, 24]),
    ...overrides,
  }
  return { queue, deps, pictures: new PictureStore(queue, deps) }
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PictureStore', () => {
  it('goes from loading to ready, with the view and the range', async () => {
    const { pictures, deps } = setup()
    const f = point()
    const key = pictureKey(f, file, 'data')
    const statuses: (string | undefined)[] = []
    pictures.subscribe(() => statuses.push(pictures.get(key)?.status))

    pictures.request(f, file, 'data')
    expect(pictures.get(key)?.status).toBe('loading')
    await flush()

    const entry = pictures.get(key)!
    expect(entry.status).toBe('ready')
    expect(entry.picture).toMatchObject({ range: [0, 24], gray: pixels.gray })
    expect(entry.picture!.view.x1 - entry.picture!.view.x0).toBeCloseTo(64_000, 3)
    expect(statuses.at(-1)).toBe('ready')
    expect(deps.fetchPicture).toHaveBeenCalledWith('feo.tif', entry.picture!.view, [0, 24], expect.any(AbortSignal))
  })

  it('fits a shape', async () => {
    const { pictures, deps } = setup()
    const f = polygon()
    pictures.request(f, file, 'data')
    await flush()
    const view = vi.mocked(deps.fetchPicture).mock.calls[0][1]
    expect(view.x1 - view.x0).toBeGreaterThan(30_000)
    expect(view.center.lat).toBeCloseTo(10.5, 1)
  })

  it('waits while the queue is paused, then loads', async () => {
    const { pictures, queue, deps } = setup()
    const f = point()
    const key = pictureKey(f, file, 'data')
    queue.pause()
    pictures.request(f, file, 'data')
    expect(pictures.get(key)?.status).toBe('waiting')
    await flush()
    expect(deps.fetchPicture).not.toHaveBeenCalled()

    queue.resume()
    expect(pictures.get(key)?.status).toBe('loading')
    await flush()
    expect(pictures.get(key)?.status).toBe('ready')
  })

  it('runs ahead of queued statistics', async () => {
    const queue = new RequestQueue(1)
    const order: string[] = []
    let finish!: () => void
    const running = queue.run('x', () => new Promise<void>(resolve => { finish = resolve }))
    const queued = queue.run('x', async () => { order.push('statistics') })
    const pictures = new PictureStore(queue, {
      fetchPicture: vi.fn(async () => { order.push('picture'); return pixels }),
      fetchFilePixelKm: vi.fn(async () => 1),
      fetchMoonRange: vi.fn(async (): Promise<[number, number]> => [0, 24]),
    })
    pictures.request(point(), file, 'data')
    finish()
    await Promise.all([running, queued])
    await flush()
    expect(order[0]).toBe('picture')
  })

  it('joins a running request for the same key', async () => {
    const { pictures, deps } = setup()
    const f = point()
    pictures.request(f, file, 'data')
    pictures.request(f, file, 'data')
    await flush()
    expect(deps.fetchPicture).toHaveBeenCalledTimes(1)
  })

  it('keeps a ready picture without a new request', async () => {
    const { pictures, deps } = setup()
    const f = point()
    pictures.request(f, file, 'data')
    await flush()
    pictures.request(f, file, 'data')
    await flush()
    expect(deps.fetchPicture).toHaveBeenCalledTimes(1)
  })

  it('fails, and loads again on a retry', async () => {
    const fetchPicture = vi.fn<PictureDependencies['fetchPicture']>()
      .mockRejectedValueOnce(new Error('HTTP 500'))
      .mockResolvedValueOnce(pixels)
    const { pictures } = setup({ fetchPicture })
    const f = point()
    const key = pictureKey(f, file, 'data')
    pictures.request(f, file, 'data')
    await flush()
    expect(pictures.get(key)?.status).toBe('failed')
    expect(pictures.get(key)?.picture).toBeUndefined()

    pictures.retry(key)
    expect(pictures.get(key)?.status).toBe('loading')
    await flush()
    expect(pictures.get(key)?.status).toBe('ready')
  })

  it('does nothing on a retry of an unknown key', () => {
    const { pictures, deps } = setup()
    pictures.retry('none')
    expect(deps.fetchFilePixelKm).not.toHaveBeenCalled()
  })

  it('fails when the file pixel cannot be read', async () => {
    const { pictures, deps } = setup({ fetchFilePixelKm: vi.fn(async () => { throw new Error('HTTP 404') }) })
    const f = point()
    pictures.request(f, file, 'data')
    await flush()
    expect(pictures.get(pictureKey(f, file, 'data'))?.status).toBe('failed')
    expect(deps.fetchPicture).not.toHaveBeenCalled()
  })

  it('fails for a point without a position and a shape without an outline', async () => {
    const { pictures } = setup()
    const noPosition = feature('a', 'point', {})
    const noOutline = feature('b', 'two-point-circle', { centerPosition: deg(1, 1) })
    pictures.request(noPosition, file, 'data')
    pictures.request(noOutline, file, 'data')
    await flush()
    expect(pictures.get(pictureKey(noPosition, file, 'data'))?.status).toBe('failed')
    expect(pictures.get(pictureKey(noOutline, file, 'data'))?.status).toBe('failed')
  })

  it('removes a canceled entry instead of failing it', async () => {
    const { pictures, queue } = setup()
    const f = point()
    const key = pictureKey(f, file, 'data')
    queue.pause()
    pictures.request(f, file, 'data')
    queue.cancelGroup(f.id)
    await flush()
    expect(pictures.get(key)).toBeUndefined()
  })

  it('aborts a running request on cancel and ignores its end', async () => {
    let signal: AbortSignal | undefined
    let finish!: () => void
    const { pictures, queue } = setup({
      fetchPicture: vi.fn(async (_f, _v, _r, s) => {
        signal = s
        await new Promise<void>(resolve => { finish = resolve })
        return pixels
      }),
    })
    const f = point()
    pictures.request(f, file, 'data')
    await flush()
    queue.cancelGroup(f.id)
    expect(signal?.aborted).toBe(true)
    finish()
    await flush()
    expect(pictures.get(pictureKey(f, file, 'data'))).toBeUndefined()
  })

  it('drops the pictures of one feature only, and a request after it starts again', async () => {
    const { pictures, deps } = setup()
    const a = point('a')
    const b = point('b')
    pictures.request(a, file, 'data')
    pictures.request(b, file, 'data')
    await flush()

    const listener = vi.fn()
    pictures.subscribe(listener)
    pictures.dropFeature('a')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(pictures.get(pictureKey(a, file, 'data'))).toBeUndefined()
    expect(pictures.get(pictureKey(b, file, 'data'))?.status).toBe('ready')

    pictures.request(a, file, 'data')
    await flush()
    expect(deps.fetchPicture).toHaveBeenCalledTimes(3)
  })

  it('does not notify when a feature holds no picture', () => {
    const { pictures } = setup()
    const listener = vi.fn()
    const unsubscribe = pictures.subscribe(listener)
    pictures.dropFeature('none')
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
  })

  it('raises its version on a change, and stops notifying after an unsubscribe', async () => {
    const { pictures } = setup()
    const listener = vi.fn()
    const unsubscribe = pictures.subscribe(listener)
    const version = pictures.getVersion()
    pictures.request(point(), file, 'data')
    expect(pictures.getVersion()).toBeGreaterThan(version)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    listener.mockClear()
    await flush()
    expect(listener).not.toHaveBeenCalled()
  })

  it('ignores a request that ends after its entry was dropped', async () => {
    let finish!: () => void
    const { pictures } = setup({
      fetchPicture: vi.fn(async () => {
        await new Promise<void>(resolve => { finish = resolve })
        return pixels
      }),
    })
    const f = point()
    pictures.request(f, file, 'data')
    await flush()
    pictures.dropFeature(f.id)
    finish()
    await flush()
    expect(pictures.get(pictureKey(f, file, 'data'))).toBeUndefined()
  })

  it('ignores a failure of a request replaced by a retry', async () => {
    let failFirst!: (error: Error) => void
    const fetchPicture = vi.fn<PictureDependencies['fetchPicture']>()
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { failFirst = reject }))
      .mockResolvedValueOnce(pixels)
    const { pictures } = setup({ fetchPicture })
    const f = point()
    const key = pictureKey(f, file, 'data')
    pictures.request(f, file, 'data')
    await flush()
    pictures.retry(key)
    await flush()
    expect(pictures.get(key)?.status).toBe('ready')
    failFirst(new Error('late'))
    await flush()
    expect(pictures.get(key)?.status).toBe('ready')
  })

  it('does not mark a replaced request as loading when it starts', async () => {
    const queue = new RequestQueue(1)
    let finish!: () => void
    const running = queue.run('x', () => new Promise<void>(resolve => { finish = resolve }))
    const fetchPicture = vi.fn(async () => pixels)
    const pictures = new PictureStore(queue, {
      fetchPicture,
      fetchFilePixelKm: vi.fn(async () => 1),
      fetchMoonRange: vi.fn(async (): Promise<[number, number]> => [0, 24]),
    })
    const f = point()
    const key = pictureKey(f, file, 'data')
    pictures.request(f, file, 'data')
    pictures.retry(key)
    finish()
    await running
    await flush()
    expect(pictures.get(key)?.status).toBe('ready')
  })

  it('keeps the last 50, dropping the oldest', async () => {
    const { pictures } = setup()
    const features = Array.from({ length: PICTURES_KEPT + 2 }, (_, i) => point(`p${i}`, i, 0))
    for (const f of features) {
      pictures.request(f, file, 'data')
      await flush()
    }
    expect(pictures.get(pictureKey(features[0], file, 'data'))).toBeUndefined()
    expect(pictures.get(pictureKey(features[1], file, 'data'))).toBeUndefined()
    expect(pictures.get(pictureKey(features[2], file, 'data'))?.status).toBe('ready')
    expect(pictures.get(pictureKey(features.at(-1)!, file, 'data'))?.status).toBe('ready')
  })

  it('counts a picture asked for again as recent', async () => {
    const { pictures } = setup()
    const features = Array.from({ length: PICTURES_KEPT }, (_, i) => point(`p${i}`, i, 0))
    for (const f of features) {
      pictures.request(f, file, 'data')
      await flush()
    }
    pictures.request(features[0], file, 'data')
    pictures.request(point('new', 80, 0), file, 'data')
    await flush()
    expect(pictures.get(pictureKey(features[0], file, 'data'))?.status).toBe('ready')
    expect(pictures.get(pictureKey(features[1], file, 'data'))).toBeUndefined()
  })

  it('drops a failed picture as old too', async () => {
    const { pictures } = setup({ fetchPicture: vi.fn(async () => { throw new Error('HTTP 500') }) })
    const features = Array.from({ length: PICTURES_KEPT + 1 }, (_, i) => point(`p${i}`, i, 0))
    for (const f of features) {
      pictures.request(f, file, 'data')
      await flush()
    }
    expect(pictures.get(pictureKey(features[0], file, 'data'))).toBeUndefined()
  })
})

describe('terrain', () => {
  it('reads the WAC file with no rescale, on the ground of the file picture', async () => {
    const { pictures, deps } = setup()
    const f = point()
    pictures.request(f, file, 'data')
    pictures.request(f, file, 'terrain')
    await flush()

    const calls = vi.mocked(deps.fetchPicture).mock.calls
    const wac = layersConfig.layers.lroc_wac_basemap.filename
    const terrain = calls.find(call => call[0] === wac)!
    const data = calls.find(call => call[0] === 'feo.tif')!
    expect(terrain[2]).toBeNull()
    expect(terrain[1]).toEqual(data[1])
    expect(deps.fetchMoonRange).toHaveBeenCalledTimes(1)
    expect(pictures.get(pictureKey(f, file, 'terrain'))?.picture?.range).toEqual([0, 255])
  })
})

describe('the whole Moon range', () => {
  const loaded = { min: 1, max: 30, loaded: true }
  const missing = { min: 0, max: 100, loaded: false }

  it('reads stored statistics with no retry', async () => {
    vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue(loaded)
    const retry = vi.spyOn(layerStatsService, 'retryMissing').mockResolvedValue()
    const queue = new RequestQueue(4)
    const fetchPicture = vi.fn(async () => pixels)
    const pictures = new PictureStore(queue, {
      fetchPicture,
      fetchFilePixelKm: vi.fn(async () => 1),
      fetchMoonRange: (await import('./PictureStore')).DEFAULT_DEPENDENCIES.fetchMoonRange,
    })
    pictures.request(point(), file, 'data')
    await flush()
    expect(retry).not.toHaveBeenCalled()
    expect(vi.mocked(fetchPicture).mock.calls[0]).toContainEqual([1, 30])
  })

  it('retries once when missing, then requests', async () => {
    vi.spyOn(layerStatsService, 'getFileStats').mockReturnValueOnce(missing).mockReturnValue(loaded)
    const retry = vi.spyOn(layerStatsService, 'retryMissing').mockResolvedValue()
    const { DEFAULT_DEPENDENCIES } = await import('./PictureStore')
    await expect(DEFAULT_DEPENDENCIES.fetchMoonRange('feo.tif')).resolves.toEqual([1, 30])
    expect(retry).toHaveBeenCalledWith(['feo.tif'])
  })

  it('fails the picture when the retry fails', async () => {
    vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue(missing)
    vi.spyOn(layerStatsService, 'retryMissing').mockResolvedValue()
    const { DEFAULT_DEPENDENCIES } = await import('./PictureStore')
    const { pictures, deps } = setup({ fetchMoonRange: DEFAULT_DEPENDENCIES.fetchMoonRange })
    const f = point()
    pictures.request(f, file, 'data')
    await flush()
    expect(pictures.get(pictureKey(f, file, 'data'))?.status).toBe('failed')
    expect(deps.fetchPicture).not.toHaveBeenCalled()
  })
})

describe('owned by InspectorStore', () => {
  function inspector() {
    const deps = defaultDependencies()
    return {
      deps,
      store: new InspectorStore({
        ...deps,
        lines: [],
        sampleElevation: vi.fn(async () => null),
        editSettleMs: 1,
      }),
    }
  }

  it('shares the area queue, so the camera pauses pictures', () => {
    const { store } = inspector()
    store.pauseAreas()
    const f = point()
    store.pictures.request(f, file, 'data')
    expect(store.pictures.get(pictureKey(f, file, 'data'))?.status).toBe('waiting')
    store.dispose()
  })

  it('drops a feature\'s pictures on delete', () => {
    const { store } = inspector()
    const f = point()
    store.sync([f])
    store.pauseAreas()
    store.pictures.request(f, file, 'data')
    store.sync([])
    expect(store.pictures.get(pictureKey(f, file, 'data'))).toBeUndefined()
    store.dispose()
  })

  it('drops a feature\'s pictures on an edit, once it settles', async () => {
    const { store } = inspector()
    const f = point()
    store.sync([f])
    store.pauseAreas()
    store.pictures.request(f, file, 'data')
    const moved = { ...f, metadata: { ...f.metadata, position: deg(31, 10) } }
    store.sync([moved])
    expect(store.pictures.get(pictureKey(f, file, 'data'))).toBeDefined()
    await new Promise(resolve => setTimeout(resolve, 10))
    expect(store.pictures.get(pictureKey(f, file, 'data'))).toBeUndefined()
    store.dispose()
  })
})
