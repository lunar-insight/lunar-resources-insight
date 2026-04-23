import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayerContext } from 'utils/context/LayerContext'
import { VariantSelector } from './VariantSelector'

vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      'thorium': {
        variants: [
          { label: '0.5°', filename: 'th_05.tif', stac: 'th_05.json' },
          { label: '2°',   filename: 'th_2.tif',  stac: 'th_2.json'  },
        ],
      },
      'no-variants': {},
      'empty-variants': { variants: [] },
    },
  },
}))

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: vi.fn(),
}))

function makeContext(overrides = {}) {
  return {
    activeVariants: new Map(),
    swappingLayers: new Set(),
    swapLayerVariant: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any
}

function stubFetch(response: object) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve(response),
  }))
}

function stubFetchError(error = new Error('Network error')) {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error))
}

beforeEach(() => {
  vi.mocked(useLayerContext).mockReturnValue(makeContext())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── No variants ─────────────────────────────────────────────────────────────

describe('when layer has no variants', () => {
  it('renders nothing when variants key is missing', () => {
    const { container } = render(<VariantSelector layerId="no-variants" />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when variants array is empty', () => {
    const { container } = render(<VariantSelector layerId="empty-variants" />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ─── Pill rendering ───────────────────────────────────────────────────────────

describe('pill rendering', () => {
  beforeEach(() => {
    stubFetch({ properties: {} })
  })

  it('renders one pill per variant', () => {
    render(<VariantSelector layerId="thorium" />)
    expect(screen.getByRole('button', { name: '0.5°' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2°' })).toBeInTheDocument()
  })

  it('selects the first pill by default', () => {
    render(<VariantSelector layerId="thorium" />)
    expect(screen.getByRole('button', { name: '0.5°' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: '2°' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects the pill matching activeVariants index', () => {
    vi.mocked(useLayerContext).mockReturnValue(
      makeContext({ activeVariants: new Map([['thorium', 1]]) })
    )
    render(<VariantSelector layerId="thorium" />)
    expect(screen.getByRole('button', { name: '0.5°' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: '2°' })).toHaveAttribute('aria-pressed', 'true')
  })
})

// ─── Disabled state ───────────────────────────────────────────────────────────

describe('disabled state during swap', () => {
  beforeEach(() => {
    stubFetch({ properties: {} })
  })

  it('disables all pills when swappingLayers contains the layerId', () => {
    vi.mocked(useLayerContext).mockReturnValue(
      makeContext({ swappingLayers: new Set(['thorium']) })
    )
    render(<VariantSelector layerId="thorium" />)
    expect(screen.getByRole('button', { name: '0.5°' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '2°' })).toBeDisabled()
  })

  it('does not disable pills when swappingLayers is empty', () => {
    render(<VariantSelector layerId="thorium" />)
    expect(screen.getByRole('button', { name: '0.5°' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: '2°' })).not.toBeDisabled()
  })
})

// ─── Pill interaction ─────────────────────────────────────────────────────────

describe('pill interaction', () => {
  beforeEach(() => {
    stubFetch({ properties: {} })
  })

  it('calls swapLayerVariant with correct args when a non-active pill is clicked', async () => {
    const swapLayerVariant = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useLayerContext).mockReturnValue(makeContext({ swapLayerVariant }))
    render(<VariantSelector layerId="thorium" />)

    await userEvent.click(screen.getByRole('button', { name: '2°' }))

    expect(swapLayerVariant).toHaveBeenCalledOnce()
    expect(swapLayerVariant).toHaveBeenCalledWith('thorium', 1)
  })

  it('does not call swapLayerVariant when the active pill is clicked', async () => {
    const swapLayerVariant = vi.fn().mockResolvedValue(undefined)
    vi.mocked(useLayerContext).mockReturnValue(makeContext({ swapLayerVariant }))
    render(<VariantSelector layerId="thorium" />)

    await userEvent.click(screen.getByRole('button', { name: '0.5°' }))

    expect(swapLayerVariant).not.toHaveBeenCalled()
  })
})

// ─── STAC metadata display ────────────────────────────────────────────────────

describe('STAC metadata display', () => {
  it('shows units and resolution when fetch returns all fields', async () => {
    stubFetch({
      properties: {
        units: 'ppm',
        grid_size_deg: 0.5,
        grid_size_km: 15,
      },
    })
    render(<VariantSelector layerId="thorium" />)

    await waitFor(() => {
      expect(screen.getByText('ppm')).toBeInTheDocument()
      expect(screen.getByText('0.5° · ~15 km/px')).toBeInTheDocument()
    })
  })

  it('uses spatial_resolution_km as fallback when grid_size_km is absent', async () => {
    stubFetch({
      properties: {
        units: 'ppm',
        spatial_resolution_km: 5,
      },
    })
    render(<VariantSelector layerId="thorium" />)

    await waitFor(() => {
      expect(screen.getByText('~5 km/px')).toBeInTheDocument()
    })
  })

  it('shows — for units and resolution when fetch fails', async () => {
    stubFetchError()
    render(<VariantSelector layerId="thorium" />)

    await waitFor(() => {
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('renders InfoButton when qualityNoteShort is present', async () => {
    stubFetch({
      properties: {
        'lri:quality_note_short': 'Moderate coverage only',
      },
    })
    render(<VariantSelector layerId="thorium" />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Quality note' })).toBeInTheDocument()
    })
  })

  it('does not render InfoButton when qualityNoteShort is absent', async () => {
    stubFetch({ properties: {} })
    render(<VariantSelector layerId="thorium" />)

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Quality note' })).not.toBeInTheDocument()
    })
  })

  it('renders the STAC link with the correct href', async () => {
    stubFetch({ properties: {} })
    render(<VariantSelector layerId="thorium" />)

    const link = screen.getByRole('link', { name: 'View full STAC record' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/stac/th_05.json')
  })
})

// ─── Cleanup on unmount ───────────────────────────────────────────────────────

describe('cleanup on unmount', () => {
  it('aborts the in-flight fetch when the component unmounts', () => {
    const abort = vi.spyOn(AbortController.prototype, 'abort')

    // Fetch that never resolves so the component is still waiting when unmounted
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))

    const { unmount } = render(<VariantSelector layerId="thorium" />)
    unmount()

    expect(abort).toHaveBeenCalled()
    abort.mockRestore()
  })
})
