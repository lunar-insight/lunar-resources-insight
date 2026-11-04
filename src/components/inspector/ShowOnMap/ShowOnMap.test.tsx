import { act, render, renderHook, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const layers = vi.hoisted(() => ({
  selectedLayers: [] as string[],
  visibleLayers: new Set<string>(),
  activeVariants: new Map<string, number>(),
  isInspectorLayer: vi.fn(() => false),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  toggleLayerVisibility: vi.fn(),
  reorderLayers: vi.fn(),
  swapLayerVariant: vi.fn(),
}))
const inspector = vi.hoisted(() => ({ pictureColor: 'gray' }))
const fly = vi.hoisted(() => ({ flyToFeature: vi.fn() }))
const viewerRef = vi.hoisted(() => ({ viewer: { id: 'viewer' } }))

vi.mock('utils/context/LayerContext', () => ({ useLayerContext: () => layers }))
vi.mock('utils/context/InspectorContext', () => ({ useInspectorContext: () => inspector }))
vi.mock('utils/context/ViewerContext', () => ({ useViewer: () => viewerRef }))
vi.mock('utils/featureUtils', () => fly)
vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      feo: { variants: [{ label: '2°' }, { label: '5°' }] },
      tio2: {},
    },
  },
}))

import type { Feature } from 'components/navigation/FeaturesSection/types'
import { useShowOnMap } from './useShowOnMap'
import { ShowOnMapToggle } from './ShowOnMapToggle'
import { ShowOnMapButton } from './ShowOnMapButton'
import { PopoverFooter } from './PopoverFooter'

const file = { layerId: 'feo', filename: 'feo_2.tif' }
const line = { symbol: 'FeO', datasetShort: 'LP GRS' }

function setLayers(selected: string[], visible: string[] = selected, fromInspector = false, variant?: number) {
  layers.selectedLayers = selected
  layers.visibleLayers = new Set(visible)
  layers.activeVariants = new Map(variant === undefined ? [] : [['feo', variant]])
  layers.isInspectorLayer.mockReturnValue(fromInspector)
}

beforeEach(() => {
  vi.clearAllMocks()
  inspector.pictureColor = 'gray'
  setLayers([])
})

describe('useShowOnMap', () => {
  const press = () => {
    const { result } = renderHook(() => useShowOnMap(file))
    act(() => result.current.press())
    return result.current
  }

  it('adds the layer in the picture colors', () => {
    inspector.pictureColor = 'viridis'
    expect(press().pressed).toBe(false)
    expect(layers.addLayer).toHaveBeenCalledWith('feo', undefined, { colormap: 'viridis', fromInspector: true })
  })

  it('shows a hidden layer and moves it to the top', () => {
    setLayers(['other', 'feo', 'last'], ['other', 'last'])
    press()
    expect(layers.toggleLayerVisibility).toHaveBeenCalledWith('feo')
    expect(layers.reorderLayers).toHaveBeenCalledWith(['feo', 'other', 'last'])
    expect(layers.addLayer).not.toHaveBeenCalled()
  })

  it('removes a layer it added and nothing adjusted', () => {
    setLayers(['feo'], ['feo'], true)
    expect(press().pressed).toBe(true)
    expect(layers.removeLayer).toHaveBeenCalledWith('feo')
    expect(layers.toggleLayerVisibility).not.toHaveBeenCalled()
  })

  it('hides a layer from the menus or adjusted, without moving it', () => {
    setLayers(['other', 'feo'])
    expect(press().pressed).toBe(true)
    expect(layers.toggleLayerVisibility).toHaveBeenCalledWith('feo')
    expect(layers.removeLayer).not.toHaveBeenCalled()
    expect(layers.reorderLayers).not.toHaveBeenCalled()
  })

  it('swaps a shown layer to the variant read, in place', () => {
    setLayers(['other', 'feo'], ['other', 'feo'], false, 1)
    expect(press().label).toBe('Show 2° on the map')
    expect(layers.swapLayerVariant).toHaveBeenCalledWith('feo', 0)
    expect(layers.toggleLayerVisibility).not.toHaveBeenCalled()
    expect(layers.reorderLayers).not.toHaveBeenCalled()
  })

  it('also shows a hidden layer on another variant', () => {
    setLayers(['other', 'feo'], ['other'], false, 1)
    press()
    expect(layers.toggleLayerVisibility).toHaveBeenCalledWith('feo')
    expect(layers.reorderLayers).toHaveBeenCalledWith(['feo', 'other'])
    expect(layers.swapLayerVariant).toHaveBeenCalledWith('feo', 0)
  })

  it('reads a layer without variants', () => {
    setLayers(['tio2'])
    const { result } = renderHook(() => useShowOnMap({ layerId: 'tio2', filename: 'tio2.tif' }))
    expect(result.current.action).toBe('hide')
  })

  it('follows changes from outside', () => {
    const { result, rerender } = renderHook(() => useShowOnMap(file))
    expect(result.current.pressed).toBe(false)
    setLayers(['feo'])
    rerender()
    expect(result.current.pressed).toBe(true)
    setLayers(['feo'], [])
    rerender()
    expect(result.current.pressed).toBe(false)
    setLayers([])
    rerender()
    expect(result.current.action).toBe('add')
  })
})

describe('ShowOnMapToggle', () => {
  it('names the line and calls the action', async () => {
    render(<ShowOnMapToggle line={line} file={file} className="reveal" />)
    const toggle = screen.getByRole('button', { name: 'FeO · LP GRS on the map' })
    expect(toggle).toHaveClass('reveal')
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(toggle)
    expect(layers.addLayer).toHaveBeenCalled()
  })

  it('shows pressed and states the next press in its tooltip', async () => {
    setLayers(['feo'], ['feo'], true)
    render(<ShowOnMapToggle line={line} file={file} />)
    const toggle = screen.getByRole('button', { name: 'FeO · LP GRS on the map' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.hover(toggle)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Remove from the map')
  })
})

describe('ShowOnMapButton', () => {
  it('reads "Show on the map" and calls the action', async () => {
    render(<ShowOnMapButton file={file} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show on the map' }))
    expect(layers.addLayer).toHaveBeenCalled()
  })

  it('reads "On the map" when pressed', () => {
    setLayers(['feo'])
    render(<ShowOnMapButton file={file} />)
    expect(screen.getByRole('button', { name: 'On the map' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('names the variant read when the map shows another', async () => {
    setLayers(['feo'], ['feo'], false, 1)
    render(<ShowOnMapButton file={file} />)
    const button = screen.getByRole('button', { name: 'Show 2° on the map' })
    await userEvent.hover(button)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('The map shows the 5° variant. This value is read from 2°.')
  })
})

describe('PopoverFooter', () => {
  it('goes to the feature', async () => {
    const feature = { id: 'f' } as Feature
    render(<PopoverFooter feature={feature} file={file} />)
    expect(screen.getByRole('button', { name: 'Show on the map' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Go to the feature' }))
    expect(fly.flyToFeature).toHaveBeenCalledWith(viewerRef.viewer, feature)
  })
})
