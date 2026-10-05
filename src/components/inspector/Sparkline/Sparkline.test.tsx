import { render } from '@testing-library/react'
import { Sparkline, seriesPath, sparkRange } from './Sparkline'
import { moonStats } from 'components/inspector/inspectorTestUtils'

describe('sparkRange', () => {
  it('spans twice the whole Moon p15 to p85 width around the average on the Moon scale', () => {
    expect(sparkRange([10, 12, 14], 'moon', moonStats)).toEqual([-8, 32])
  })

  it('fits the line to its own range', () => {
    expect(sparkRange([10, 12, 14], 'own', moonStats)).toEqual([10, 14])
  })

  it('uses the own range when the statistics did not load', () => {
    expect(sparkRange([10, 14], 'moon', { min: 0, max: 100, loaded: false })).toEqual([10, 14])
  })
})

describe('seriesPath', () => {
  it('breaks the path where a sample has no data', () => {
    expect(seriesPath([1, 2, null, 4], i => i, v => v)).toBe('M0.00 1.00 L1.00 2.00 M3.00 4.00')
  })
})

describe('Sparkline', () => {
  it('draws the profile at the sample positions', () => {
    const { container } = render(
      <Sparkline profile={[1, null, 3]} fractions={[0, 0.5, 1]} scale="own" moon={moonStats} categoryRgb="1, 2, 3" />
    )
    const path = container.querySelector('path')!
    expect(path.getAttribute('d')).toBe('M0.00 15.00 M66.00 1.00')
    expect(path.getAttribute('stroke')).toBe('rgb(1, 2, 3)')
  })

  it('keeps an empty well without values', () => {
    const { container } = render(
      <Sparkline profile={[null]} fractions={[0]} scale="moon" moon={moonStats} categoryRgb="0, 0, 0" />
    )
    expect(container.querySelector('svg')).toBeNull()
    expect(container.firstChild).toBeInTheDocument()
  })
})
