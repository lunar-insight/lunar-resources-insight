import { formatDistance } from './formatDistance'

describe('formatDistance', () => {
  it('formats sub-kilometer distances in meters with one decimal', () => {
    expect(formatDistance(12.34)).toBe('12.3 m')
  })

  it('formats zero as meters', () => {
    expect(formatDistance(0)).toBe('0.0 m')
  })

  it('switches to kilometers at exactly 1000 meters', () => {
    expect(formatDistance(1000)).toBe('1.00 km')
  })

  it('formats large distances in kilometers with two decimals', () => {
    expect(formatDistance(123456.789)).toBe('123.46 km')
  })

  it('stays in meters just under the kilometer threshold', () => {
    expect(formatDistance(999.9)).toBe('999.9 m')
  })
})
