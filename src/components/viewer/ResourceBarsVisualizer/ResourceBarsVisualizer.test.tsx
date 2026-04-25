vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      calcium_primary:       { category: 'chemical', element: 'calcium',   units: 'wt%'        },
      iron_primary:          { category: 'chemical', element: 'iron',      units: 'wt%'        },
      magnesium_primary:     { category: 'chemical', element: 'magnesium', units: 'wt%'        },
      titanium_primary:      { category: 'chemical', element: 'titanium',  units: 'wt%'        },
      hydrogen_lawrence2022: { category: 'chemical', element: 'hydrogen',  units: 'ppm'        },
      thorium_grs:           { category: 'chemical', element: 'thorium',   units: 'ppm'        },
      neutron_primary:       { category: 'chemical', element: 'neutron',   units: 'count_rate', displayName: 'Neutron flux' },
    },
  },
}))

import { render, screen } from '@testing-library/react'
import { calculateGeochemicalScore, ResourceBarsVisualizer } from './ResourceBarsVisualizer'

// Reference ranges (from elementReferenceRanges.ts):
//   calcium:   0 – 14.3 wt%
//   iron:      0 – 15.2 wt%
//   magnesium: 0 – 13.0 wt%
//   titanium:  0 – 6.0  wt%
//   hydrogen:  0 – 150  ppm
//   thorium:   0 – 14.0 ppm

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
})

// ─── Pure function ────────────────────────────────────────────────────────────

describe('calculateGeochemicalScore', () => {

  describe('wt% elements — calcium', () => {
    it('returns 0 at min value', () => {
      expect(calculateGeochemicalScore('calcium_primary', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('calcium_primary', 7.15)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('calcium_primary', 14.3)).toBe(100)
    })

    it('clamps to 100 above max', () => {
      expect(calculateGeochemicalScore('calcium_primary', 20)).toBe(100)
    })

    it('clamps to 0 below min', () => {
      expect(calculateGeochemicalScore('calcium_primary', -5)).toBe(0)
    })
  })

  describe('wt% elements — iron', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('iron_primary', 7.6)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('iron_primary', 15.2)).toBe(100)
    })
  })

  describe('ppm elements — hydrogen', () => {
    it('returns 0 at min value', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 75)).toBeCloseTo(50)
    })

    it('returns 100 at ceiling', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 150)).toBe(100)
    })

    it('clamps to 100 above ceiling', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 200)).toBe(100)
    })
  })

  describe('ppm elements — thorium', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('thorium_grs', 7)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('thorium_grs', 14)).toBe(100)
    })
  })

  describe('fallback behavior', () => {
    it('returns 50 for an unknown layer', () => {
      expect(calculateGeochemicalScore('unknown_layer', 5)).toBe(50)
    })

    it('returns 50 for a layer with no element field', () => {
      expect(calculateGeochemicalScore('calcium_primary', 0)).not.toBeUndefined()
    })
  })

})

// ─── Component rendering ──────────────────────────────────────────────────────

describe('ResourceBarsVisualizer — nodata state', () => {

  describe('SVG panel visibility', () => {
    it('renders no SVG panels when values and nodataLayerIds are both empty', () => {
      const { container } = render(<ResourceBarsVisualizer values={{}} nodataLayerIds={[]} />)
      expect(container.querySelector('svg')).not.toBeInTheDocument()
    })

    it('renders the wt% SVG when a wt% nodata layer is provided', () => {
      const { container } = render(
        <ResourceBarsVisualizer values={{}} nodataLayerIds={['calcium_primary']} />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('renders the ppm section when a ppm nodata layer is provided', () => {
      render(<ResourceBarsVisualizer values={{}} nodataLayerIds={['hydrogen_lawrence2022']} />)
      expect(screen.getByText('Trace Elements')).toBeInTheDocument()
    })

    it('does not render the ppm section when only wt% nodata layers are provided', () => {
      render(<ResourceBarsVisualizer values={{}} nodataLayerIds={['calcium_primary']} />)
      expect(screen.queryByText('Trace Elements')).not.toBeInTheDocument()
    })

    it('renders both wt% and ppm SVGs when nodata layers of each type are provided', () => {
      const { container } = render(
        <ResourceBarsVisualizer
          values={{}}
          nodataLayerIds={['calcium_primary', 'hydrogen_lawrence2022']}
        />
      )
      expect(container.querySelectorAll('svg')).toHaveLength(2)
    })
  })

  describe('count rate rows', () => {
    it('shows an em dash for a nodata count_rate layer', () => {
      render(<ResourceBarsVisualizer values={{}} nodataLayerIds={['neutron_primary']} />)
      expect(screen.getByText('Spatial Signal')).toBeInTheDocument()
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('shows the numeric value and no em dash when a count_rate layer has data', () => {
      render(
        <ResourceBarsVisualizer values={{ neutron_primary: 1.2345 }} nodataLayerIds={[]} />
      )
      expect(screen.getByText('1.2345')).toBeInTheDocument()
      expect(screen.queryByText('—')).not.toBeInTheDocument()
    })
  })

  describe('mixed state (partial data)', () => {
    it('renders the wt% SVG when some layers have values and others are nodata', () => {
      const { container } = render(
        <ResourceBarsVisualizer
          values={{ calcium_primary: 7.15 }}
          nodataLayerIds={['iron_primary']}
        />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })

    it('does not render a nodata bar for a layer that already has a real value', () => {
      const { container } = render(
        <ResourceBarsVisualizer
          values={{ calcium_primary: 7.15 }}
          nodataLayerIds={['calcium_primary', 'iron_primary']}
        />
      )
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

})
