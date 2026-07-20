vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      mg_number: {
        category: 'derived-index',
        isDerivedIndex: true,
        displayName: 'Mg# Magnesium Number · Clementine CNN (Qiu 2025)',
        units: 'Mg# (0 to 1)',
      },
    },
  },
}))

vi.mock('components/navigation/submenu/DerivedIndices/data', () => ({
  DERIVED_INDEX_BY_LAYER_ID: {
    mg_number: { lowLabel: 'Mare', highLabel: 'Highland', range: [0, 1] as [number, number] },
  },
}))

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: () => ({ getLayerStyle: (): undefined => undefined }),
}))

vi.mock('services/LayerStatsService', () => ({
  layerStatsService: { getLayerStats: () => ({ min: 0, max: 1, loaded: true }) },
}))

vi.mock('services/ColormapService', () => ({
  colormapService: { getGradientUrl: () => '' },
}))

import { render, screen } from '@testing-library/react'
import { normalizePosition, DerivedIndexVisualizer } from './DerivedIndexVisualizer'

// ─── Pure function ────────────────────────────────────────────────────────────

describe('normalizePosition', () => {
  it('returns 0 at min of range',              () => expect(normalizePosition(0, [0, 1])).toBe(0))
  it('returns 1 at max of range',              () => expect(normalizePosition(1, [0, 1])).toBe(1))
  it('returns 0.5 at midpoint',                () => expect(normalizePosition(0.5, [0, 1])).toBe(0.5))
  it('clamps to 0 below min',                  () => expect(normalizePosition(-0.5, [0, 1])).toBe(0))
  it('clamps to 1 above max',                  () => expect(normalizePosition(1.5, [0, 1])).toBe(1))
  it('works with non-zero min (custom range)', () => expect(normalizePosition(5, [0, 10])).toBeCloseTo(0.5))
})

// ─── Component rendering ──────────────────────────────────────────────────────

describe('DerivedIndexVisualizer — empty state', () => {
  it('shows empty state when values and nodataLayerIds are both empty', () => {
    render(<DerivedIndexVisualizer values={{}} />)
    expect(screen.getByText(/no derived index layers/i)).toBeInTheDocument()
  })
})

describe('DerivedIndexVisualizer — active row', () => {
  it('renders the trimmed display name', () => {
    render(<DerivedIndexVisualizer values={{ mg_number: 0.65 }} />)
    expect(screen.getByText('Mg# Magnesium Number')).toBeInTheDocument()
  })

  it('renders lowLabel and highLabel', () => {
    render(<DerivedIndexVisualizer values={{ mg_number: 0.65 }} />)
    expect(screen.getByText('Highland')).toBeInTheDocument()
    expect(screen.getByText('Mare')).toBeInTheDocument()
  })

  it('renders the numeric value formatted to 3 decimal places', () => {
    render(<DerivedIndexVisualizer values={{ mg_number: 0.65 }} />)
    expect(screen.getByText('0.650')).toBeInTheDocument()
  })

  it('does not show N/A when the layer has a value', () => {
    render(<DerivedIndexVisualizer values={{ mg_number: 0.65 }} />)
    expect(screen.queryByText('N/A')).not.toBeInTheDocument()
  })
})

describe('DerivedIndexVisualizer — nodata row', () => {
  it('shows N/A for a nodata layer', () => {
    render(<DerivedIndexVisualizer values={{}} nodataLayerIds={['mg_number']} />)
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('still renders the display name for a nodata layer', () => {
    render(<DerivedIndexVisualizer values={{}} nodataLayerIds={['mg_number']} />)
    expect(screen.getByText('Mg# Magnesium Number')).toBeInTheDocument()
  })

  it('does not render a numeric value for a nodata layer', () => {
    render(<DerivedIndexVisualizer values={{}} nodataLayerIds={['mg_number']} />)
    expect(screen.queryByText(/^\d+\.\d{3}$/)).not.toBeInTheDocument()
  })
})

describe('DerivedIndexVisualizer — unknown layer IDs', () => {
  it('silently skips layer IDs not in DERIVED_INDEX_BY_LAYER_ID', () => {
    render(<DerivedIndexVisualizer values={{ unknown_layer: 0.5 }} />)
    expect(screen.getByText(/no derived index layers/i)).toBeInTheDocument()
  })
})
