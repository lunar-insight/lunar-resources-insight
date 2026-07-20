import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

// ─── Category tag ────────────────────────────────────────────────────────

it('renders the category as a tag with a matching data-category attribute', () => {
  render(<LayersCatalog />)

  const row = screen.getByRole('row', { name: 'Layer With Data' })
  const tag = within(row).getByText('Chemical')
  expect(tag).toHaveAttribute('data-category', 'chemical')
})

// ─── Filtering ────────────────────────────────────────────────────────────

describe('filtering', () => {
  it('filters rows by title via the search field', async () => {
    const user = userEvent.setup()
    render(<LayersCatalog />)

    await user.type(screen.getByRole('searchbox', { name: 'Search layers by title' }), 'Without STAC')

    expect(screen.getByRole('row', { name: 'Layer Without STAC' })).toBeInTheDocument()
    expect(screen.queryByRole('row', { name: 'Layer With Data' })).not.toBeInTheDocument()
  })

  it('shows an empty state when no row matches the search text', async () => {
    const user = userEvent.setup()
    render(<LayersCatalog />)

    await user.type(screen.getByRole('searchbox', { name: 'Search layers by title' }), 'no such layer')

    expect(screen.getByText('No layers match the current filters.')).toBeInTheDocument()
  })

  it('hides rows for a category when its filter chip is deselected', async () => {
    const user = userEvent.setup()
    render(<LayersCatalog />)

    await user.click(screen.getByRole('button', { name: 'Chemical' }))

    expect(screen.queryByRole('row', { name: 'Layer With Data' })).not.toBeInTheDocument()
    expect(screen.queryByRole('row', { name: 'Layer Fetch Fails' })).not.toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Layer No Metadata' })).toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Layer Without STAC' })).toBeInTheDocument()
  })
})
