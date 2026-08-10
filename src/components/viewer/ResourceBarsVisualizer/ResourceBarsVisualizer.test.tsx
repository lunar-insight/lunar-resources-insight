vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      calcium_primary:       { category: 'chemical', element: 'calcium',   units: 'wt%'        },
      iron_primary:          { category: 'chemical', element: 'iron',      units: 'wt%'        },
      iron_secondary:        { category: 'chemical', element: 'iron',      units: 'wt%', displayName: 'Iron Abundance · Kaguya XRS' },
      magnesium_primary:     { category: 'chemical', element: 'magnesium', units: 'wt%'        },
      titanium_primary:      { category: 'chemical', element: 'titanium',  units: 'wt%'        },
      hydrogen_lawrence2022: { category: 'chemical', element: 'hydrogen',  units: 'ppm'        },
      thorium_grs:           { category: 'chemical', element: 'thorium',   units: 'ppm'        },
      neutron_primary:       { category: 'chemical', element: 'neutron',   units: 'count_rate', displayName: 'Neutron flux' },
      feo_primary:           { category: 'compound', compound: 'feo',      units: 'wt%'        },
      tio2_primary:          { category: 'compound', compound: 'tio2',     units: 'wt%'        },
    },
  },
}))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { calculateAbundanceScore, ResourceBarsVisualizer } from './ResourceBarsVisualizer'

// Reference ranges (from elementReferenceRanges.ts):
//   calcium:   0 – 14.3 wt%   iron:      0 – 15.2 wt%
//   magnesium: 0 – 13.0 wt%   titanium:  0 – 6.0  wt%
//   hydrogen:  0 – 150  ppm   thorium:   0 – 14.0 ppm
//   feo:       0 – 22.0 wt%   tio2:      0 – 15.0 wt%

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
})

// ─── Pure function ────────────────────────────────────────────────────────────

describe('calculateAbundanceScore', () => {

  describe('wt% elements — calcium', () => {
    it('returns 0 at min value', () => {
      expect(calculateAbundanceScore('calcium_primary', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('calcium_primary', 7.15)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateAbundanceScore('calcium_primary', 14.3)).toBe(100)
    })

    it('clamps to 100 above max', () => {
      expect(calculateAbundanceScore('calcium_primary', 20)).toBe(100)
    })

    it('clamps to 0 below min', () => {
      expect(calculateAbundanceScore('calcium_primary', -5)).toBe(0)
    })
  })

  describe('wt% elements — iron', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('iron_primary', 7.6)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateAbundanceScore('iron_primary', 15.2)).toBe(100)
    })
  })

  describe('ppm elements — hydrogen', () => {
    it('returns 0 at min value', () => {
      expect(calculateAbundanceScore('hydrogen_lawrence2022', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('hydrogen_lawrence2022', 75)).toBeCloseTo(50)
    })

    it('returns 100 at ceiling', () => {
      expect(calculateAbundanceScore('hydrogen_lawrence2022', 150)).toBe(100)
    })

    it('clamps to 100 above ceiling', () => {
      expect(calculateAbundanceScore('hydrogen_lawrence2022', 200)).toBe(100)
    })
  })

  describe('ppm elements — thorium', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('thorium_grs', 7)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateAbundanceScore('thorium_grs', 14)).toBe(100)
    })
  })

  describe('fallback behavior', () => {
    it('returns 50 for an unknown layer', () => {
      expect(calculateAbundanceScore('unknown_layer', 5)).toBe(50)
    })

    it('returns 50 for a layer with no element field', () => {
      expect(calculateAbundanceScore('calcium_primary', 0)).not.toBeUndefined()
    })
  })

  describe('compound — feo', () => {
    it('returns 0 at min value', () => {
      expect(calculateAbundanceScore('feo_primary', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('feo_primary', 11)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateAbundanceScore('feo_primary', 22)).toBe(100)
    })

    it('clamps to 100 above max', () => {
      expect(calculateAbundanceScore('feo_primary', 30)).toBe(100)
    })
  })

  describe('compound — tio2', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateAbundanceScore('tio2_primary', 7.5)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateAbundanceScore('tio2_primary', 15)).toBe(100)
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

// ─── Compound panel ───────────────────────────────────────────────────────────

describe('ResourceBarsVisualizer — compound panel', () => {

  describe('panel visibility', () => {
    it('renders the Compounds panel when compound values are provided', () => {
      render(<ResourceBarsVisualizer values={{ feo_primary: 11 }} nodataLayerIds={[]} />)
      expect(screen.getByText('Compounds')).toBeInTheDocument()
    })

    it('renders the Compounds panel when a compound nodata layer is provided', () => {
      render(<ResourceBarsVisualizer values={{}} nodataLayerIds={['feo_primary']} />)
      expect(screen.getByText('Compounds')).toBeInTheDocument()
    })

    it('does not render Major Elements when only compound values are provided', () => {
      render(<ResourceBarsVisualizer values={{ feo_primary: 11 }} nodataLayerIds={[]} />)
      expect(screen.queryByText('Major Elements')).not.toBeInTheDocument()
    })

    it('does not render Compounds panel when only element values are provided', () => {
      render(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} />)
      expect(screen.queryByText('Compounds')).not.toBeInTheDocument()
    })

    it('renders both panels when element and compound values are provided together', () => {
      render(
        <ResourceBarsVisualizer
          values={{ calcium_primary: 7, feo_primary: 11 }}
          nodataLayerIds={[]}
        />
      )
      expect(screen.getByText('Major Elements')).toBeInTheDocument()
      expect(screen.getByText('Compounds')).toBeInTheDocument()
    })
  })

})

// ─── Dataset picker (multiple layers resolving to one element) ────────────────

describe('ResourceBarsVisualizer — dataset picker', () => {

  describe('picker visibility', () => {
    it('renders no picker button for an element with a single selected layer', () => {
      render(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} />)
      expect(screen.queryByRole('button', { name: /choose which dataset/i })).not.toBeInTheDocument()
    })

    it('renders a picker button for an element with two selected layers', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6, iron_secondary: 6.9 }}
          nodataLayerIds={[]}
        />
      )
      expect(screen.getByRole('button', { name: /Fe: choose which dataset/i })).toBeInTheDocument()
    })

    it('renders no picker button when only one of the two layers is selected at all', () => {
      render(<ResourceBarsVisualizer values={{ iron_primary: 7.6 }} nodataLayerIds={[]} />)
      expect(screen.queryByRole('button', { name: /choose which dataset/i })).not.toBeInTheDocument()
    })

    it('keeps the picker button visible when one of the two selected layers has no value at this pixel', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_secondary: 6.9 }}
          nodataLayerIds={['iron_primary']}
        />
      )
      expect(screen.getByRole('button', { name: /Fe: choose which dataset/i })).toBeInTheDocument()
    })

    it('keeps the picker button visible on the nodata placeholder bar when both selected layers have no value', () => {
      render(
        <ResourceBarsVisualizer
          values={{}}
          nodataLayerIds={['iron_primary', 'iron_secondary']}
        />
      )
      expect(screen.getByText('N/A')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Fe: choose which dataset/i })).toBeInTheDocument()
    })

    it('keeps the picker button visible when the active candidate itself has no value at this pixel', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map([['Fe', 'iron_secondary']])}
        />
      )
      expect(screen.getByRole('button', { name: /Fe: choose which dataset/i })).toBeInTheDocument()
    })
  })

  describe('default and controlled selection', () => {
    it('shows the value of the first candidate when no active selection is provided', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6, iron_secondary: 6.9 }}
          nodataLayerIds={[]}
        />
      )
      expect(screen.getByText('7.60')).toBeInTheDocument()
      expect(screen.queryByText('6.90')).not.toBeInTheDocument()
    })

    it('shows the value of the layer named in activeDatasetBySymbol', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6, iron_secondary: 6.9 }}
          nodataLayerIds={[]}
          activeDatasetBySymbol={new Map([['Fe', 'iron_secondary']])}
        />
      )
      expect(screen.getByText('6.90')).toBeInTheDocument()
      expect(screen.queryByText('7.60')).not.toBeInTheDocument()
    })

    it('shows nodata for the symbol when the selected layer has no value here, even though another candidate does', () => {
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map([['Fe', 'iron_secondary']])}
        />
      )
      expect(screen.queryByText('7.60')).not.toBeInTheDocument()
      expect(screen.getByText('N/A')).toBeInTheDocument()
    })
  })

  describe('picking a dataset', () => {
    it('lists each candidate with its own displayName or layer id, and its live value', async () => {
      const user = userEvent.setup()
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6, iron_secondary: 6.9 }}
          nodataLayerIds={[]}
        />
      )
      await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('iron_primary')).toBeInTheDocument()
      expect(within(dialog).getByText('7.60 wt%')).toBeInTheDocument()
      expect(within(dialog).getByText('Iron Abundance · Kaguya XRS')).toBeInTheDocument()
      expect(within(dialog).getByText('6.90 wt%')).toBeInTheDocument()
    })

    it('calls onSelectDataset with the symbol and the chosen layer id', async () => {
      const user = userEvent.setup()
      const onSelectDataset = vi.fn()
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6, iron_secondary: 6.9 }}
          nodataLayerIds={[]}
          activeDatasetBySymbol={new Map()}
          onSelectDataset={onSelectDataset}
        />
      )
      await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

      const dialog = screen.getByRole('dialog')
      const otherPill = within(dialog).getByText('Iron Abundance · Kaguya XRS').closest('button')
      expect(otherPill).not.toBeNull()
      await user.click(otherPill!)

      expect(onSelectDataset).toHaveBeenCalledOnce()
      expect(onSelectDataset).toHaveBeenCalledWith('Fe', 'iron_secondary')
    })

    it('switches the bar to nodata once a picked candidate with no value is applied', async () => {
      const user = userEvent.setup()
      const onSelectDataset = vi.fn()
      const { rerender } = render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map()}
          onSelectDataset={onSelectDataset}
        />
      )
      expect(screen.getByText('7.60')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))
      const dialog = screen.getByRole('dialog')
      const nodataPill = within(dialog).getByText('Iron Abundance · Kaguya XRS').closest('button')
      await user.click(nodataPill!)

      expect(onSelectDataset).toHaveBeenCalledWith('Fe', 'iron_secondary')

      rerender(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map([['Fe', 'iron_secondary']])}
          onSelectDataset={onSelectDataset}
        />
      )

      expect(screen.queryByText('7.60')).not.toBeInTheDocument()
      expect(screen.getByText('N/A')).toBeInTheDocument()
    })

    it('lists a nodata candidate with a placeholder value and still allows selecting it', async () => {
      const user = userEvent.setup()
      const onSelectDataset = vi.fn()
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map()}
          onSelectDataset={onSelectDataset}
        />
      )
      await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('Iron Abundance · Kaguya XRS')).toBeInTheDocument()
      expect(within(dialog).getByText('No data here')).toBeInTheDocument()

      const nodataPill = within(dialog).getByText('Iron Abundance · Kaguya XRS').closest('button')
      expect(nodataPill).not.toBeNull()
      await user.click(nodataPill!)

      expect(onSelectDataset).toHaveBeenCalledWith('Fe', 'iron_secondary')
    })

    it('shows a nodata candidate as active when it is the stored preference', async () => {
      const user = userEvent.setup()
      render(
        <ResourceBarsVisualizer
          values={{ iron_primary: 7.6 }}
          nodataLayerIds={['iron_secondary']}
          activeDatasetBySymbol={new Map([['Fe', 'iron_secondary']])}
        />
      )
      // The selected candidate has no value here, so the bar itself is nodata.
      expect(screen.getByText('N/A')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: /Fe: choose which dataset/i }))

      const dialog = screen.getByRole('dialog')
      expect(
        within(dialog).getByRole('button', { name: 'Iron Abundance · Kaguya XRS, No data here, active' })
      ).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'iron_primary, 7.60 wt%' })).toBeInTheDocument()
    })

    it('does not call onSelectDataset for a layer that does not resolve to an element with multiple candidates', () => {
      // Sanity check on the fixture itself: a lone element must not expose a picker to click.
      render(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

})

// ─── Paused (dim) state ─────────────────────────────────────────────────────

describe('ResourceBarsVisualizer — paused state', () => {
  it('does not apply the paused class by default', () => {
    const { container } = render(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} />)
    expect(container.firstElementChild?.className).not.toMatch(/paused/)
  })

  it('does not apply the paused class when isPaused is false', () => {
    const { container } = render(
      <ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} isPaused={false} />
    )
    expect(container.firstElementChild?.className).not.toMatch(/paused/)
  })

  it('applies the paused class when isPaused is true', () => {
    const { container } = render(
      <ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} isPaused />
    )
    expect(container.firstElementChild?.className).toMatch(/paused/)
  })

  it('keeps showing the last real value while paused', () => {
    const { rerender } = render(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} />)
    expect(screen.getByText('7.00')).toBeInTheDocument()

    rerender(<ResourceBarsVisualizer values={{ calcium_primary: 7 }} nodataLayerIds={[]} isPaused />)
    expect(screen.getByText('7.00')).toBeInTheDocument()
  })
})
