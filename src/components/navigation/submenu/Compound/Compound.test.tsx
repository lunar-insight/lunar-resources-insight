import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLayersByCompound } from 'geoConfigExporter'
import CompoundComponent from './Compound'
import { COMPOUND_LAYER_MAP } from './data'

const layerContext = vi.hoisted(() => ({
  selectedLayers: [] as string[],
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
}))

vi.mock('utils/context/LayerContext', () => ({ useLayerContext: () => layerContext }))

const feoLayers = getLayersByCompound('feo')
const feoInfo = COMPOUND_LAYER_MAP['FeO']

const option = (list: string, name: string) => {
  const found = within(screen.getByRole('listbox', { name: list }))
    .getAllByRole('option')
    .find(item => item.textContent?.includes(name))
  if (!found) throw new Error(`No option ${name} in ${list}`)
  return found
}
const feo = () => option('Lunar Soil Oxides', 'FeO')
const carbonDioxide = () => option('Gases and Volatiles', 'CO₂')

beforeEach(() => {
  layerContext.selectedLayers = []
  vi.clearAllMocks()
})

describe('Compound selection', () => {
  it('reads several layers for a compound', () => {
    expect(feoLayers.length).toBeGreaterThan(1)
  })

  it('selects nothing without layers', () => {
    render(<CompoundComponent />)
    expect(feo()).toHaveAttribute('aria-selected', 'false')
  })

  it('selects a compound when one of its layers is on the map', () => {
    layerContext.selectedLayers = [feoLayers[1]]
    render(<CompoundComponent />)
    expect(feo()).toHaveAttribute('aria-selected', 'true')
  })

  it('adds a compound on press, with its name and category', async () => {
    render(<CompoundComponent />)
    await userEvent.click(feo())
    expect(layerContext.addLayer).toHaveBeenCalledExactlyOnceWith(feoInfo.id, {
      displayName: feoInfo.displayName,
      category: 'compound',
    })
  })

  it('removes a compound on press', async () => {
    layerContext.selectedLayers = [feoLayers[0]]
    render(<CompoundComponent />)
    await userEvent.click(feo())
    expect(layerContext.removeLayer).toHaveBeenCalledExactlyOnceWith(feoInfo.id)
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('does nothing on a compound without a map layer', async () => {
    render(<CompoundComponent />)
    expect(carbonDioxide()).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(carbonDioxide())
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('leaves the layers alone on select all', async () => {
    layerContext.selectedLayers = [feoLayers[0]]
    render(<CompoundComponent />)
    feo().focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    expect(layerContext.addLayer).not.toHaveBeenCalled()
    expect(layerContext.removeLayer).not.toHaveBeenCalled()
  })
})
