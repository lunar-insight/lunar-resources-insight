import { render } from '@testing-library/react'
import { barPath, ShapeHistogram } from './ShapeHistogram'

const histogram = { counts: [4, 11, 36, 0, 7, 2], edges: [0, 4, 8, 12, 16, 20, 24] }

const draw = (overrides = {}) => render(
  <ShapeHistogram histogram={histogram} median={5.84} mean={9.13} p15={3.9} p85={15.8}
    line={{ decimals: 1, unit: 'wt%' }} categoryColor="red" {...overrides} />
).container

describe('ShapeHistogram', () => {
  it('draws a bar for each bin holding pixels, scaled to the highest', () => {
    const container = draw()
    const bars = [...container.querySelectorAll('[data-bin]')].map(bin => bin.querySelector('path'))
    expect(bars).toHaveLength(6)
    expect(bars[3]).toBeNull()
    expect(bars[2]!.getAttribute('d')).toBe(barPath(71, 4, 33, 42))
  })

  it('gives every bin a hover text, empty ones too', () => {
    const titles = [...draw().querySelectorAll('[data-bin] title')].map(title => title.textContent)
    expect(titles[0]).toBe('0.0 to 4.0 wt%: 7% of pixels')
    expect(titles[3]).toBe('12.0 to 16.0 wt%: 0% of pixels')
  })

  it('places the median, the average and the Most band on the axis', () => {
    const container = draw()
    const x = (mark: string) => Number(container.querySelector(`[data-mark="${mark}"]`)!.getAttribute('x1'))
    expect(x('median')).toBeCloseTo((5.84 / 24) * 210)
    expect(x('mean')).toBeCloseTo((9.13 / 24) * 210)
    expect(container.querySelector('[data-mark="mean"]')).toHaveAttribute('stroke-dasharray', '3 2')
    const band = container.querySelector('svg > rect')!
    expect(Number(band.getAttribute('x'))).toBeCloseTo((3.9 / 24) * 210)
    expect(Number(band.getAttribute('width'))).toBeCloseTo(((15.8 - 3.9) / 24) * 210)
  })

  it('labels the axis ends with the lowest and highest value', () => {
    expect(draw().textContent).toMatch(/of pixels0\.024\.0MedianAverage$/)
  })

  it('rounds only the top corners, never past a short bar', () => {
    expect(barPath(0, 10, 4, 6)).toBe('M0 16V11.5Q0 10 1.5 10H2.5Q4 10 4 11.5V16Z')
    expect(barPath(0, 15, 4, 1)).toBe('M0 16V16Q0 15 1 15H3Q4 15 4 16V16Z')
  })
})
