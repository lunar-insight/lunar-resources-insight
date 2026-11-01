import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CoverageIcon, CoveragePie, EmptySlot, LimitGlyph, LimitIcon, LowResolutionGlyph, SpreadGlyph, SpreadIcon,
} from './RowIcons'

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

describe('CoverageIcon', () => {
  it('reads "Partial data" with the covered share', async () => {
    render(<CoverageIcon coverage={42.4} inComparison />)
    await userEvent.click(screen.getByRole('button', { name: 'Partial data, 42%' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('so it is not ranked')
  })
})
