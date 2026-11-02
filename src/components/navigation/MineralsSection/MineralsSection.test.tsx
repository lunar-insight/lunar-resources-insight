import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getLayersByMineral } from 'geoConfigExporter'
import MineralsSection from './MineralsSection'

const layerContext = vi.hoisted(() => ({
  selectedLayers: [] as string[],
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
}))
const zIndex = vi.hoisted(() => ({ registerModal: vi.fn(), unregisterModal: vi.fn() }))

vi.mock('utils/context/LayerContext', () => ({ useLayerContext: () => layerContext }))
vi.mock('utils/ZIndexProvider', () => ({ useZIndex: () => zIndex }))
vi.mock('hooks/useMouseTrackingControl', () => ({ useMouseTrackingControl: vi.fn() }))

// One rock with a map layer: no rock has one in the real configuration.
vi.mock('geoConfigExporter', async importOriginal => {
  const actual = await importOriginal<typeof import('geoConfigExporter')>()
  return {
    ...actual,
    layersConfig: {
      ...actual.layersConfig,
      layers: { ...actual.layersConfig.layers, basalt: { filename: 'basalt.tif', displayName: 'Basalt' } },
    },
  }
})

const plagioclaseLayers = getLayersByMineral('plagioclase')

const option = (list: string, name: string) => {
  const found = within(screen.getByRole('listbox', { name: list }))
    .getAllByRole('option')
    .find(item => item.textContent?.includes(name))
  if (!found) throw new Error(`No option ${name} in ${list}`)
  return found
}
const plagioclase = () => option('Silicate Minerals', 'Plagioclase')
const quartz = () => option('Silicate Minerals', 'Quartz')
const basalt = () => option('Lunar Rocks', 'Basalt')
const anorthosite = () => option('Lunar Rocks', 'Anorthosite')

const section = () => <MineralsSection />

async function open() {
  const view = render(section())
  await userEvent.click(screen.getByRole('button', { name: 'Rocks & Minerals' }))
  return view
}

beforeEach(() => {
  layerContext.selectedLayers = []
  vi.clearAllMocks()
})

describe('MineralsSection selection', () => {
  it('reads a mineral map layer from the configuration', () => {
    expect(plagioclaseLayers.length).toBeGreaterThan(1)
  })

  it('selects nothing without layers', async () => {
    await open()
    expect(plagioclase()).toHaveAttribute('aria-selected', 'false')
    expect(basalt()).toHaveAttribute('aria-selected', 'false')
  })

  it('selects a mineral when one of its layers was added elsewhere', async () => {
    const { rerender } = await open()
    layerContext.selectedLayers = [plagioclaseLayers[1]]
    rerender(section())
    expect(plagioclase()).toHaveAttribute('aria-selected', 'true')
  })

  it('selects a mineral opened with a layer already on the map', async () => {
    layerContext.selectedLayers = [plagioclaseLayers[0]]
    await open()
    expect(plagioclase()).toHaveAttribute('aria-selected', 'true')
  })

  it('unselects a mineral when its layers were removed elsewhere', async () => {
    layerContext.selectedLayers = [plagioclaseLayers[0]]
    const { rerender } = await open()
    layerContext.selectedLayers = []
    rerender(section())
    expect(plagioclase()).toHaveAttribute('aria-selected', 'false')
  })

  it('adds every layer of a mineral on press', async () => {
    await open()
    await userEvent.click(plagioclase())
    expect(layerContext.addLayer.mock.calls).toEqual(plagioclaseLayers.map(id => [id]))
    expect(layerContext.removeLayer).not.toHaveBeenCalled()
  })

  it('removes every layer of a mineral on press, when one of them is on the map', async () => {
    layerContext.selectedLayers = [plagioclaseLayers[0]]
    await open()
    await userEvent.click(plagioclase())
    expect(layerContext.removeLayer.mock.calls).toEqual(plagioclaseLayers.map(id => [id]))
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('does nothing on a mineral without a map layer', async () => {
    await open()
    expect(quartz()).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(quartz())
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('follows the layers for a rock', async () => {
    const { rerender } = await open()
    layerContext.selectedLayers = ['basalt']
    rerender(section())
    expect(basalt()).toHaveAttribute('aria-selected', 'true')
    layerContext.selectedLayers = []
    rerender(section())
    expect(basalt()).toHaveAttribute('aria-selected', 'false')
  })

  it('adds a rock on press, with its name and category', async () => {
    await open()
    await userEvent.click(basalt())
    expect(layerContext.addLayer).toHaveBeenCalledExactlyOnceWith('basalt', { displayName: 'Basalt', category: 'rock' })
  })

  it('removes a rock on press', async () => {
    layerContext.selectedLayers = ['basalt']
    await open()
    await userEvent.click(basalt())
    expect(layerContext.removeLayer).toHaveBeenCalledExactlyOnceWith('basalt')
  })

  it('does nothing on a rock without a map layer', async () => {
    await open()
    expect(anorthosite()).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(anorthosite())
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })

  it('leaves the layers alone on select all in the minerals', async () => {
    layerContext.selectedLayers = [plagioclaseLayers[0]]
    await open()
    plagioclase().focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    expect(layerContext.addLayer).not.toHaveBeenCalled()
    expect(layerContext.removeLayer).not.toHaveBeenCalled()
  })

  it('leaves the layers alone on select all in the rocks', async () => {
    await open()
    basalt().focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    expect(layerContext.addLayer).not.toHaveBeenCalled()
  })
})

describe('MineralsSection highlights and modal', () => {
  it('highlights the minerals of a hovered rock, and clears them on leave', async () => {
    await open()
    await userEvent.hover(basalt())
    expect(plagioclase().className).toMatch(/highlighted/)
    expect(quartz().className).not.toMatch(/highlighted/)
    await userEvent.unhover(basalt())
    expect(plagioclase().className).not.toMatch(/highlighted/)
  })

  it('highlights the rocks holding a hovered mineral, and clears them on leave', async () => {
    await open()
    await userEvent.hover(plagioclase())
    expect(anorthosite().className).toMatch(/highlighted/)
    await userEvent.unhover(plagioclase())
    expect(anorthosite().className).not.toMatch(/highlighted/)
  })

  it('registers the modal while open', async () => {
    await open()
    expect(zIndex.registerModal).toHaveBeenCalledWith('minerals-modal')
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getAllByRole('button')[0])
    expect(zIndex.unregisterModal).toHaveBeenCalledWith('minerals-modal')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
