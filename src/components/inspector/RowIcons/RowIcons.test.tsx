import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CoverageIcon, CoveragePie, EmptySlot, LowResolutionGlyph, SpreadGlyph, SpreadIcon } from './RowIcons'

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
    render(<SpreadIcon line={{ decimals: 1, unit: 'wt%' }} state={{
      kind: 'spread', word: 'Variable', p15: 5, p85: 9, lowest: 2, highest: 12, pulled: null,
    }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Most5.0 to 9.0 wt%')
  })

  it('shows low resolution with the cell count', async () => {
    render(<SpreadIcon line={{ decimals: 1 }} state={{ kind: 'low-resolution', cellSizeKm: 150, cells: 2.4 }} />)
    await userEvent.click(screen.getByRole('button', { name: 'Low resolution' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Cells here2')
  })
})

describe('CoverageIcon', () => {
  it('reads "Partial data" with the covered share', async () => {
    render(<CoverageIcon coverage={42.4} inComparison />)
    await userEvent.click(screen.getByRole('button', { name: 'Partial data, 42%' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('so it is not ranked')
  })
})
