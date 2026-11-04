import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import { layerStatsService } from 'services/LayerStatsService'
import type { InspectorLine } from 'services/inspector/inspectorLayers'
import { spreadLabel, type SpreadState } from 'services/inspector/inspectorStatistics'
import histogramStyles from 'components/inspector/ShapeHistogram/ShapeHistogram.module.scss'
import {
  CoverageIcon, CoveragePie, EmptySlot, LimitGlyph, LimitIcon, LowResolutionGlyph, SpreadGlyph, SpreadIcon,
} from './RowIcons'

const viewer = vi.hoisted(() => ({ props: [] as Record<string, unknown>[] }))

vi.mock('components/inspector/MiniViewer/MiniViewer', () => ({
  MiniViewer: (props: Record<string, unknown>) => {
    viewer.props.push(props)
    return <figure data-testid="viewer" />
  },
}))

vi.mock('components/inspector/ShowOnMap/PopoverFooter', () => ({
  PopoverFooter: () => <div data-testid="footer" />,
}))

const heights = (container: HTMLElement) =>
  [...container.querySelectorAll('rect')].map(rect => Number(rect.getAttribute('height')))

describe('glyphs', () => {
  it('draws four spread bars on a common baseline', () => {
    const { container } = render(<svg><SpreadGlyph word="Highly variable" /></svg>)
    expect(heights(container)).toEqual([2, 11, 4, 12])
    const bottoms = [...container.querySelectorAll('rect')].map(r => Number(r.getAttribute('y')) + Number(r.getAttribute('height')))
    expect(new Set(bottoms).size).toBe(1)
  })

  it('draws level bars for Uniform and uneven bars for Variable', () => {
    expect(heights(render(<svg><SpreadGlyph word="Uniform" /></svg>).container)).toEqual([7, 7, 7, 7])
    expect(heights(render(<svg><SpreadGlyph word="Variable" /></svg>).container)).toEqual([5, 9, 6, 10])
  })

  it('adds the skew dot at the top left only when skewed', () => {
    expect(render(<SpreadGlyph word="Variable" />).container.querySelector('[data-mark="skew"]')).toBeNull()
    const dot = render(<SpreadGlyph word="Variable" skewed />).container.querySelector('[data-mark="skew"]')!
    expect([dot.getAttribute('cx'), dot.getAttribute('cy'), dot.getAttribute('r')]).toEqual(['2.1', '2.1', '2.1'])
  })

  it('draws the limit arrow against a ceiling or a floor', () => {
    expect(render(<LimitGlyph end="high" />).container.querySelector('rect')!.getAttribute('y')).toBe('1.25')
    expect(render(<LimitGlyph end="low" />).container.querySelector('rect')!.getAttribute('y')).toBe('11.25')
  })

  it('draws four cells for low resolution', () => {
    const { container } = render(<svg><LowResolutionGlyph /></svg>)
    expect(container.querySelectorAll('rect')).toHaveLength(4)
  })

  it('fills the pie to the covered share, with a large arc past half', () => {
    const quarter = render(<CoveragePie percent={25} />).container.querySelector('path')!.getAttribute('d')
    expect(quarter).toContain('A5.5 5.5 0 0 1 12.50 7.00')
    const most = render(<CoveragePie percent={71} />).container.querySelector('path')!.getAttribute('d')
    expect(most).toContain('0 1 1 ')
    expect(render(<CoveragePie percent={0} />).container.querySelector('path')).toBeNull()
  })

  it('keeps an empty slot', () => {
    const { container } = render(<EmptySlot />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('SpreadIcon', () => {
  it('names the spread word and explains it on press', async () => {
    render(<SpreadIcon line={{ decimals: 1, unit: 'wt%' }} categoryColor="red" state={{
      kind: 'spread', word: 'Variable', mean: 6.5, median: 6, p15: 5, p85: 9, lowest: 2, highest: 12, skew: null,
    }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Median6.0 wt%Most5.0 to 9.0 wt%')
    expect(screen.queryByRole('img', { name: 'Histogram of pixel values' })).toBeNull()
  })

  it('draws the histogram and drops Lowest and Highest', async () => {
    render(<SpreadIcon line={{ decimals: 1, unit: 'wt%' }} categoryColor="red" state={{
      kind: 'spread', word: 'Variable', mean: 6.5, median: 6, p15: 5, p85: 9, lowest: 2, highest: 12, skew: null,
      histogram: { counts: [3, 1], edges: [2, 7, 12] },
    }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('img', { name: 'Histogram of pixel values' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('2.012.0MedianAverage')
    expect(dialog).not.toHaveTextContent('Lowest')
  })

  it('names the skew and states it on press', async () => {
    const { container } = render(<SpreadIcon line={{ decimals: 1, unit: 'wt%' }} categoryColor="red" state={{
      kind: 'spread', word: 'Variable', mean: 9.1, median: 5.8, p15: 4, p85: 15, lowest: 1, highest: 24, skew: 'below',
    }} />)
    expect(container.querySelector('[data-mark="skew"]')).not.toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Variable, more than half below the average' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('More than half the shape is below the average.')
  })

  it('shows low resolution with the cell count', async () => {
    render(<SpreadIcon line={{ decimals: 1 }} categoryColor="red" state={{ kind: 'low-resolution', cellSizeKm: 150, cells: 2.4 }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Low resolution' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Cells here2')
  })
})

describe('LimitIcon', () => {
  it('names the limit and gives the note on press', async () => {
    render(<LimitIcon line={{ decimals: 1, unit: 'wt%' }} state={{ end: 'high', limit: 18, note: 'A pixel at 18 wt% stands for 18 wt% or more.' }} />)
    await userEvent.click(screen.getByRole('button', { name: "At the map's limit" }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Limit18.0 wt%')
    expect([...dialog.querySelectorAll('p')].map(p => p.textContent))
      .toEqual(['Values beyond the limit are set to it.', 'A pixel at 18 wt% stands for 18 wt% or more.'])
  })
})

describe('with a picture', () => {
  const feature = { id: 'f', name: 'F', type: 'polygon', color: '#fff', metadata: {} } as unknown as Feature
  const file = { layerId: 'feo', filename: 'feo.tif' }
  const fullLine = { decimals: 1, unit: 'wt%', category: 'compound', cardName: 'Iron oxide', datasetLabel: 'MI' } as InspectorLine
  const picture = { feature, line: fullLine, file }
  const spread = {
    kind: 'spread' as const, word: 'Variable' as const, mean: 6.5, median: 6, p15: 5, p85: 9, lowest: 0, highest: 24, skew: null as null,
    histogram: { counts: [3, 1], edges: [0, 12, 24] },
  }

  beforeEach(() => {
    viewer.props = []
    vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue({ min: 0, max: 24, loaded: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const open = async (state: SpreadState = spread) => {
    render(<SpreadIcon line={fullLine} categoryColor="red" state={state} picture={picture} />)
    await userEvent.click(screen.getByRole('button', { name: spreadLabel(state) }))
    return screen.getByRole('dialog')
  }
  const lastHighlight = () => viewer.props.at(-1)!.highlight
  const barsOf = (dialog: HTMLElement) => [...dialog.querySelectorAll('[data-bin] path')]

  it('places the picture above the histogram, and the footer last', async () => {
    const dialog = await open()
    expect(within(dialog).getByTestId('viewer')).toBeInTheDocument()
    const order = [...dialog.children].map(el => el.getAttribute('data-testid') ?? el.tagName)
    expect(order.indexOf('viewer')).toBeLessThan(order.findIndex(tag => tag === 'DIV'))
    expect(order.at(-1)).toBe('footer')
    expect(viewer.props[0]).toMatchObject({ feature, file, line: fullLine })
  })

  it('gives low resolution the picture too', async () => {
    const dialog = await open({ kind: 'low-resolution', cellSizeKm: 150, cells: 2.4 })
    expect(within(dialog).getByTestId('viewer')).toBeInTheDocument()
    expect(within(dialog).getByTestId('footer')).toBeInTheDocument()
  })

  it('lights a bar on hover, on the picture and the histogram, and clears on leaving', async () => {
    const dialog = await open()
    const bin = dialog.querySelectorAll('[data-bin]')[1]
    fireEvent.mouseEnter(bin)
    expect(lastHighlight()).toEqual({ range: [12, 24], text: '12.0 to 24.0 wt%: 25% of the shape' })
    expect(barsOf(dialog)[1].classList.contains(histogramStyles.hot)).toBe(true)
    expect(barsOf(dialog)[0].classList.contains(histogramStyles.cold)).toBe(true)
    fireEvent.mouseLeave(bin)
    expect(lastHighlight()).toBeNull()
    expect(barsOf(dialog)[1].classList.contains(histogramStyles.hot)).toBe(false)
  })

  it('lights Most on hover, with its fixed share, and no other line', async () => {
    const dialog = await open()
    await userEvent.hover(within(dialog).getByText('Most'))
    expect(lastHighlight()).toEqual({ range: [5, 9], text: '5.0 to 9.0 wt%: 70% of the shape' })
    await userEvent.hover(within(dialog.querySelector('dl')!).getByText('Median'))
    expect(lastHighlight()).toBeNull()
  })

  it('lights nothing on a bin narrower than 2 gray levels, and keeps its tooltip', async () => {
    vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue({ min: 0, max: 24000, loaded: true })
    const dialog = await open()
    const bin = dialog.querySelectorAll('[data-bin]')[1]
    fireEvent.mouseEnter(bin)
    expect(lastHighlight()).toBeNull()
    expect(barsOf(dialog)[1].classList.contains(histogramStyles.hot)).toBe(false)
    expect(bin.querySelector('title')).toHaveTextContent('12.0 to 24.0 wt%')
  })

  it('clears the highlight on close', async () => {
    const dialog = await open()
    fireEvent.mouseEnter(dialog.querySelectorAll('[data-bin]')[1])
    expect(lastHighlight()).not.toBeNull()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    expect(lastHighlight()).toBeNull()
  })

  it('lights nothing without a picture', async () => {
    render(<SpreadIcon line={fullLine} categoryColor="red" state={spread} />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.mouseEnter(dialog.querySelectorAll('[data-bin]')[1])
    expect(barsOf(dialog)[1].classList.contains(histogramStyles.hot)).toBe(false)
    expect(within(dialog).queryByTestId('viewer')).toBeNull()
  })

  it('gives the limit popover the picture, with the limit and its longitudes', async () => {
    render(<LimitIcon line={fullLine} picture={picture} longitudes={[-180, 60]} state={{ end: 'high', limit: 18 }} />)
    await userEvent.click(screen.getByRole('button', { name: "At the map's limit" }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByTestId('footer')).toBeInTheDocument()
    expect(viewer.props[0].limit).toEqual({ value: 18, longitudes: [-180, 60] })
  })

  it('leaves the limit popover plain without a picture', async () => {
    render(<LimitIcon line={fullLine} state={{ end: 'high', limit: 18 }} />)
    await userEvent.click(screen.getByRole('button', { name: "At the map's limit" }))
    expect(within(screen.getByRole('dialog')).queryByTestId('viewer')).toBeNull()
  })
})

describe('CoverageIcon', () => {
  it('reads "Partial data" with the covered share', async () => {
    render(<CoverageIcon coverage={42.4} inComparison />)
    await userEvent.click(screen.getByRole('button', { name: 'Partial data, 42%' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('so it is not ranked')
  })
})
