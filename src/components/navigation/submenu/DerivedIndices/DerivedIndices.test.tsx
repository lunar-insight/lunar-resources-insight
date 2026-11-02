import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLayersByCompound } from 'geoConfigExporter'
import DerivedIndices from './DerivedIndices'

const layerContext = vi.hoisted(() => ({
  selectedLayers: [] as string[],
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
}))

vi.mock('utils/context/LayerContext', () => ({ useLayerContext: () => layerContext }))

// A second selectable index: select all does not reach the handler when the one
// selectable index of the real data is already selected.
vi.mock('./data', async importOriginal => {
  const actual = await importOriginal<typeof import('./data')>()
  const second = { ...actual.DERIVED_INDICES[0], id: 'second', symbol: 'Second', layerId: 'second_layer', disabled: false }
  return {
    ...actual,
    DERIVED_INDICES: [...actual.DERIVED_INDICES, second],
    DERIVED_INDEX_LAYER_MAP: {
      ...actual.DERIVED_INDEX_LAYER_MAP,
      second: { id: 'second_layer', displayName: 'Second index' },
    },
  }
})

const option = (name: string) => {
  const found = screen.getAllByRole('option').find(item => item.textContent?.includes(name))
  if (!found) throw new Error(`No option ${name}`)
  return found
}
const mgNumber = () => option('Mg#')

beforeEach(() => {
  layerContext.selectedLayers = []
  vi.clearAllMocks()
})

describe('DerivedIndices selection', () => {
  it('follows the layers on the map', () => {
    layerContext.selectedLayers = ['mg_number']
    render(<DerivedIndices />)
    expect(mgNumber()).toHaveAttribute('aria-selected', 'true')
    expect(option('Second')).toHaveAttribute('aria-selected', 'false')
  })

  it('adds an index on press, with its name and category', async () => {
    render(<DerivedIndices />)
    await userEvent.click(mgNumber())
    expect(layerContext.addLayer).toHaveBeenCalledExactlyOnceWith('mg_number', {
      displayName: 'Mg# Magnesium Number',
      category: 'derived-index',
    })
  })

  it('removes an index on press', async () => {
    layerContext.selectedLayers = ['mg_number']
    render(<DerivedIndices />)
    await userEvent.click(mgNumber())
    expect(layerContext.removeLayer).toHaveBeenCalledExactlyOnceWith('mg_number')
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('leaves the layers alone on select all', async () => {
    layerContext.selectedLayers = ['mg_number']
    render(<DerivedIndices />)
    mgNumber().focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    expect(layerContext.addLayer).not.toHaveBeenCalled()
    expect(layerContext.removeLayer).not.toHaveBeenCalled()
  })

  it('marks an input compound as loaded when one of its layers is on the map', () => {
    layerContext.selectedLayers = [getLayersByCompound('feo')[0]]
    render(<DerivedIndices />)
    expect(screen.getAllByTitle('Layer loaded').length).toBeGreaterThan(0)
    expect(screen.getAllByTitle('Layer not loaded').length).toBeGreaterThan(0)
  })
})
