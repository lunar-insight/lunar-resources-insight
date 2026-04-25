vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      calcium_primary:       { category: 'chemical', element: 'calcium'   },
      iron_primary:          { category: 'chemical', element: 'iron'      },
      magnesium_primary:     { category: 'chemical', element: 'magnesium' },
      titanium_primary:      { category: 'chemical', element: 'titanium'  },
      hydrogen_lawrence2022: { category: 'chemical', element: 'hydrogen'  },
      thorium_grs:           { category: 'chemical', element: 'thorium'   },
    },
  },
}))

import { calculateGeochemicalScore } from './ResourceBarsVisualizer'

// Reference ranges (from elementReferenceRanges.ts):
//   calcium:   0 – 14.3 wt%
//   iron:      0 – 15.2 wt%
//   magnesium: 0 – 13.0 wt%
//   titanium:  0 – 6.0  wt%
//   hydrogen:  0 – 150  ppm
//   thorium:   0 – 14.0 ppm

describe('calculateGeochemicalScore', () => {

  describe('wt% elements — calcium', () => {
    it('returns 0 at min value', () => {
      expect(calculateGeochemicalScore('calcium_primary', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('calcium_primary', 7.15)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('calcium_primary', 14.3)).toBe(100)
    })

    it('clamps to 100 above max', () => {
      expect(calculateGeochemicalScore('calcium_primary', 20)).toBe(100)
    })

    it('clamps to 0 below min', () => {
      expect(calculateGeochemicalScore('calcium_primary', -5)).toBe(0)
    })
  })

  describe('wt% elements — iron', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('iron_primary', 7.6)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('iron_primary', 15.2)).toBe(100)
    })
  })

  describe('ppm elements — hydrogen', () => {
    it('returns 0 at min value', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 0)).toBe(0)
    })

    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 75)).toBeCloseTo(50)
    })

    it('returns 100 at ceiling', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 150)).toBe(100)
    })

    it('clamps to 100 above ceiling', () => {
      expect(calculateGeochemicalScore('hydrogen_lawrence2022', 200)).toBe(100)
    })
  })

  describe('ppm elements — thorium', () => {
    it('returns 50 at midpoint', () => {
      expect(calculateGeochemicalScore('thorium_grs', 7)).toBeCloseTo(50)
    })

    it('returns 100 at max value', () => {
      expect(calculateGeochemicalScore('thorium_grs', 14)).toBe(100)
    })
  })

  describe('fallback behavior', () => {
    it('returns 50 for an unknown layer', () => {
      expect(calculateGeochemicalScore('unknown_layer', 5)).toBe(50)
    })

    it('returns 50 for a layer with no element field', () => {
      expect(calculateGeochemicalScore('calcium_primary', 0)).not.toBeUndefined()
    })
  })

})
