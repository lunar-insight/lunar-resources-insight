import { parseCoordinateInput } from './coordinateParser'

describe('parseCoordinateInput', () => {
  it('parses a comma-separated lat, lon pair', () => {
    expect(parseCoordinateInput('12.34, -56.78')).toEqual({ lat: 12.34, lon: -56.78 })
  })

  it('parses a space-separated lat lon pair', () => {
    expect(parseCoordinateInput('12.34 -56.78')).toEqual({ lat: 12.34, lon: -56.78 })
  })

  it('parses an optional third value as altitude', () => {
    expect(parseCoordinateInput('12.34, -56.78, 50000')).toEqual({ lat: 12.34, lon: -56.78, altitude: 50000 })
  })

  it('parses a space-separated lat lon altitude triple', () => {
    expect(parseCoordinateInput('12.34 -56.78 50000')).toEqual({ lat: 12.34, lon: -56.78, altitude: 50000 })
  })

  it('accepts longitude up to 360 (East convention)', () => {
    expect(parseCoordinateInput('0, 350')).toEqual({ lat: 0, lon: 350 })
  })

  it('returns null for a feature name', () => {
    expect(parseCoordinateInput('Tycho')).toBeNull()
  })

  it('returns null for a single number', () => {
    expect(parseCoordinateInput('12.34')).toBeNull()
  })

  it('returns null when latitude is out of range', () => {
    expect(parseCoordinateInput('91, 12')).toBeNull()
  })

  it('returns null when longitude is out of range', () => {
    expect(parseCoordinateInput('12, 361')).toBeNull()
  })

  it('returns null when altitude is negative', () => {
    expect(parseCoordinateInput('12, 34, -10')).toBeNull()
  })

  it('returns null when altitude exceeds the sane maximum', () => {
    expect(parseCoordinateInput('12, 34, 500000000000')).toBeNull()
  })

  it('returns null when altitude overflows to Infinity (e.g. a long run of zeros)', () => {
    expect(parseCoordinateInput(`12, 34, 9${'0'.repeat(320)}`)).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(parseCoordinateInput('')).toBeNull()
  })
})
