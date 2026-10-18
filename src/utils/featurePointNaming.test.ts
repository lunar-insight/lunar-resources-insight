import { parseCoordinateInput } from './coordinateParser'
import { formatCoordinatePair } from './featurePointNaming'

describe('formatCoordinatePair', () => {
  it('writes lat, lon with 6 decimals', () => {
    expect(formatCoordinatePair(-18.2145371, -32.08816)).toBe('-18.214537, -32.088160')
  })

  it('takes another number of decimals', () => {
    expect(formatCoordinatePair(4.16092, -5.56643, 4)).toBe('4.1609, -5.5664')
  })

  it('reads back through the search parser', () => {
    expect(parseCoordinateInput(formatCoordinatePair(22.584919, -50.5))).toEqual({ lat: 22.584919, lon: -50.5 })
  })
})
