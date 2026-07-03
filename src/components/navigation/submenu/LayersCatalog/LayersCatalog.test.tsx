import { render, screen, within, waitFor } from '@testing-library/react'
import LayersCatalog from './LayersCatalog'

vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      'layer-with-data': {
        displayName: 'Layer With Data',
        category: 'chemical',
        stac: 'layer-with-data.json',
      },
      'layer-fetch-fails': {
        displayName: 'Layer Fetch Fails',
        category: 'chemical',
        stac: 'layer-fetch-fails.json',
      },
      'layer-no-metadata': {
        displayName: 'Layer No Metadata',
        category: 'geographical',
        stac: 'layer-no-metadata.json',
      },
      'layer-without-stac': {
        displayName: 'Layer Without STAC',
        category: 'geographical',
      },
    },
  },
}))

function mockStacFetch(responses: Record<string, object | 'error'>) {
  vi.stubGlobal('fetch', vi.fn((url: string) => {
    const path = url.replace('/stac/', '')
    const response = responses[path]

    if (response === 'error') {
      return Promise.reject(new Error('Network error'))
    }
    if (response === undefined) {
      return Promise.resolve({ ok: false, status: 404, statusText: 'Not Found' })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(response),
    })
  }))
}

beforeEach(() => {
  mockStacFetch({
    'layer-with-data.json': {
      properties: {
        mission: 'Test Mission',
        instruments: ['Test Instrument'],
        spatial_resolution_m: 50,
      },
    },
    'layer-fetch-fails.json': 'error',
    'layer-no-metadata.json': {
      properties: {},
    },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── Static columns ────────────────────────────────────────────────────────

it('includes layers without a stac path, showing - for Source, Resolution, and STAC', async () => {
  render(<LayersCatalog />)

  // Sync point: wait for a sibling row's fetch to resolve first.
  await waitFor(() => {
    expect(screen.getByText('Test Mission · Test Instrument')).toBeInTheDocument()
  })

  const row = screen.getByRole('row', { name: 'Layer Without STAC' })
  expect(within(row).getAllByText('-')).toHaveLength(3)
})

// ─── STAC-derived columns ────────────────────────────────────────────────────

describe('Source and Resolution columns', () => {
  it('show - before the STAC fetch resolves', () => {
    render(<LayersCatalog />)
    const row = screen.getByRole('row', { name: 'Layer With Data' })
    expect(within(row).getAllByText('-')).toHaveLength(2)
  })

  it('populate once the STAC fetch resolves', async () => {
    render(<LayersCatalog />)
    const row = screen.getByRole('row', { name: 'Layer With Data' })

    await waitFor(() => {
      expect(within(row).getByText('Test Mission · Test Instrument')).toBeInTheDocument()
      expect(within(row).getByText('50m/pixel')).toBeInTheDocument()
    })
  })

  it('stay at - when the STAC fetch fails', async () => {
    render(<LayersCatalog />)

    // Sync point: wait for a sibling row's fetch to resolve so the failing
    // row's rejected promise has settled too (Promise.all awaits all of them).
    await waitFor(() => {
      expect(screen.getByText('Test Mission · Test Instrument')).toBeInTheDocument()
    })

    const row = screen.getByRole('row', { name: 'Layer Fetch Fails' })
    expect(within(row).getAllByText('-')).toHaveLength(2)
  })

  it('stay at - when the STAC item has no matching properties', async () => {
    render(<LayersCatalog />)

    await waitFor(() => {
      expect(screen.getByText('Test Mission · Test Instrument')).toBeInTheDocument()
    })

    const row = screen.getByRole('row', { name: 'Layer No Metadata' })
    expect(within(row).getAllByText('-')).toHaveLength(2)
  })
})
