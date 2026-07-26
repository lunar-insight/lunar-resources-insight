import { getStacRole, stacService, STAC_BASE_PATH } from './StacService'

describe('getStacRole', () => {
  it('returns the lri:role value when present', () => {
    expect(getStacRole({ 'lri:role': 'Estimated' })).toBe('Estimated')
  })

  it('returns undefined when lri:role is absent', () => {
    expect(getStacRole({})).toBeUndefined()
  })
})

// ─── stacService.fetchStacItem ──────────────────────────────────────────────
// Each test uses its own stac path: stacService is a module-level singleton,
// so a shared path would leak cache state between tests.

function mockFetch(response: object | 'error' | 'not-found') {
  const fetchMock = vi.fn(() => {
    if (response === 'error') return Promise.reject(new Error('Network error'))
    if (response === 'not-found') return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(response) })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('stacService.fetchStacItem', () => {
  it('requests STAC_BASE_PATH joined with the given path', async () => {
    const fetchMock = mockFetch({ properties: {} })

    await stacService.fetchStacItem('fetch-item/request-url.json')

    expect(fetchMock).toHaveBeenCalledWith(
      `${STAC_BASE_PATH}/fetch-item/request-url.json`,
      { cache: 'no-store' }
    )
  })

  it('resolves with the parsed STAC item on success', async () => {
    mockFetch({ properties: { 'lri:role': 'Measured' } })

    const item = await stacService.fetchStacItem('fetch-item/success.json')

    expect(item?.properties['lri:role']).toBe('Measured')
  })

  it('fetches a given path only once, caching subsequent calls', async () => {
    const fetchMock = mockFetch({ properties: {} })

    await stacService.fetchStacItem('fetch-item/cached.json')
    await stacService.fetchStacItem('fetch-item/cached.json')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fetches independently for different paths', async () => {
    const fetchMock = mockFetch({ properties: {} })

    await stacService.fetchStacItem('fetch-item/path-a.json')
    await stacService.fetchStacItem('fetch-item/path-b.json')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('resolves null when the response is not ok', async () => {
    mockFetch('not-found')

    const item = await stacService.fetchStacItem('fetch-item/missing.json')

    expect(item).toBeNull()
  })

  it('resolves null instead of throwing when fetch rejects', async () => {
    mockFetch('error')

    await expect(stacService.fetchStacItem('fetch-item/network-error.json')).resolves.toBeNull()
  })
})
