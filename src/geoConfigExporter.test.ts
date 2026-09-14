import { vi, describe, it, expect, beforeAll, beforeEach } from 'vitest'

const fetchStacItem = vi.fn()

vi.mock('./services/StacService', () => ({
  stacService: { fetchStacItem: (path: string) => fetchStacItem(path) },
}))

const GEOGRAPHIC_WKT = 'GEOGCS["Moon (2015) - Sphere / Ocentric",AUTHORITY["IAU","30100"]]'
const POLAR_WKT = 'PROJCS["Moon (2015) - Sphere / Ocentric / North Polar",AUTHORITY["IAU","30130"]]'

function mockInfo(body: object) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

let fetchLayerBounds: typeof import('./geoConfigExporter').fetchLayerBounds

beforeAll(async () => {
  vi.stubEnv('VITE_SERVER_URL', '')
  vi.stubEnv('VITE_WORKSPACE_PATH', '/data')
  ;({ fetchLayerBounds } = await import('./geoConfigExporter'))
})

beforeEach(() => {
  fetchStacItem.mockReset()
})

describe('fetchLayerBounds', () => {
  it('returns the tiler bounds of a geographic raster', async () => {
    mockInfo({ bounds: [-180, -50, 180, 50], crs: GEOGRAPHIC_WKT })

    await expect(fetchLayerBounds('a_COG.tif', 'a.json')).resolves.toEqual([-180, -50, 180, 50])
    expect(fetchStacItem).not.toHaveBeenCalled()
  })

  it('returns the catalog bbox of a projected raster', async () => {
    mockInfo({ bounds: [-1267472, -1267472, 1267472, 1267472], crs: POLAR_WKT })
    fetchStacItem.mockResolvedValue({ bbox: [-180, 49.8, 180, 90], properties: {} })

    await expect(fetchLayerBounds('north_COG.tif', 'north.json')).resolves.toEqual([-180, 49.8, 180, 90])
    expect(fetchStacItem).toHaveBeenCalledWith('north.json')
  })

  it('returns global bounds for a projected raster with no catalog bbox', async () => {
    mockInfo({ bounds: [-1267472, -1267472, 1267472, 1267472], crs: POLAR_WKT })
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    await expect(fetchLayerBounds('north_COG.tif')).resolves.toEqual([-180, -90, 180, 90])
  })
})
