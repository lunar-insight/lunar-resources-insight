import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const context = vi.hoisted(() => ({
  updateStyle: vi.fn(),
  getLayerStyle: vi.fn(),
}))

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: () => context,
}))

vi.mock('services/LayerStatsService', () => ({
  layerStatsService: { getLayerStats: () => ({ min: 2, max: 40, loaded: true }) },
}))

import LayerGradientSelect from './LayerGradientSelect'

beforeEach(() => {
  context.updateStyle.mockClear()
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    unobserve() {}
    disconnect() {}
  })
})

afterEach(() => vi.unstubAllGlobals())

const shownValue = () => screen.getByRole('button', { name: /Select a gradient/ })

describe('LayerGradientSelect', () => {
  it('shows gray for a layer without a style', () => {
    context.getLayerStyle.mockReturnValue(undefined)
    render(<LayerGradientSelect layerId="feo" />)
    expect(shownValue()).toHaveTextContent(/gray/i)
  })

  it('shows a stored style', () => {
    context.getLayerStyle.mockReturnValue({ type: 'viridis', colors: [], min: 1, max: 2 })
    render(<LayerGradientSelect layerId="feo" />)
    expect(shownValue()).toHaveTextContent(/viridis/i)
  })

  it('updates the style on a change, keeping a stored range', async () => {
    context.getLayerStyle.mockReturnValue({ type: 'gray', colors: [], min: 1, max: 2 })
    render(<LayerGradientSelect layerId="feo" />)
    await userEvent.click(shownValue())
    await userEvent.click(screen.getByRole('option', { name: /viridis/i }))
    expect(context.updateStyle).toHaveBeenCalledWith('feo', { type: 'viridis', colors: [], min: 1, max: 2 })
    expect(shownValue()).toHaveTextContent(/viridis/i)
  })

  it('takes the range from the statistics without a stored one', async () => {
    context.getLayerStyle.mockReturnValue(undefined)
    render(<LayerGradientSelect layerId="feo" />)
    await userEvent.click(shownValue())
    await userEvent.click(screen.getByRole('option', { name: /viridis/i }))
    expect(context.updateStyle).toHaveBeenCalledWith('feo', { type: 'viridis', colors: [], min: 2, max: 40 })
  })
})
