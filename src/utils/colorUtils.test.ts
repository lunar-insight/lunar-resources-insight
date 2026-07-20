vi.mock('cesium', () => ({
  Color: class {
    static CYAN = {}
    constructor() {}
  },
}))

vi.mock('geoConfigExporter', () => ({
  layersConfig: {
    layers: {
      'hydrogen-raster': { category: 'chemical', element: 'Hydrogen' },
      'iron-raster':     { category: 'chemical', element: 'Iron'     },
      'thorium-raster':  { category: 'chemical', element: 'Thorium'  },
      'terrain-layer':   { category: 'terrain'                       },
    },
  },
}))

import { elementToAccentColor } from 'utils/colorUtils'

// Configured elements sorted by atomic number: Hydrogen(1) → rank 0, Iron(26) → rank 1, Thorium(90) → rank 2
// hue = Math.round(rank * 137.5 % 360)

describe('elementToAccentColor', () => {
  describe('rank-based hue assignment', () => {
    it('assigns rank 0 to the lowest atomic number configured element', () => {
      expect(elementToAccentColor('Hydrogen')).toBe('hsl(0, 70%, 62%)')
    })

    it('assigns rank 1 to the second configured element', () => {
      expect(elementToAccentColor('Iron')).toBe('hsl(138, 70%, 62%)')
    })

    it('assigns rank 2 to the third configured element', () => {
      expect(elementToAccentColor('Thorium')).toBe('hsl(275, 70%, 62%)')
    })

    it('produces a distinct color for each configured element', () => {
      const colors = new Set([
        elementToAccentColor('Hydrogen'),
        elementToAccentColor('Iron'),
        elementToAccentColor('Thorium'),
      ])
      expect(colors.size).toBe(3)
    })
  })

  describe('case insensitivity', () => {
    it('returns the same color regardless of input casing', () => {
      expect(elementToAccentColor('HYDROGEN')).toBe(elementToAccentColor('hydrogen'))
      expect(elementToAccentColor('Iron')).toBe(elementToAccentColor('IRON'))
    })
  })

  describe('fallback for unconfigured elements', () => {
    it('returns a valid hsl string for elements not in layersConfig', () => {
      expect(elementToAccentColor('Oxygen')).toMatch(/^hsl\(\d+, 70%, 62%\)$/)
    })

    it('does not collide with any configured element color', () => {
      const configured = new Set([
        elementToAccentColor('Hydrogen'),
        elementToAccentColor('Iron'),
        elementToAccentColor('Thorium'),
      ])
      expect(configured).not.toContain(elementToAccentColor('Oxygen'))
    })

    it('returns a stable color for the same unconfigured element', () => {
      expect(elementToAccentColor('Oxygen')).toBe(elementToAccentColor('Oxygen'))
    })
  })

  describe('non-chemical layers are excluded from ranking', () => {
    it('does not treat non-chemical layer categories as configured elements', () => {
      // 'terrain-layer' has category 'terrain', so 'terrain' is not a configured element
      // and falls back to the hash — it must not affect the rank of the 3 chemical elements
      expect(elementToAccentColor('Hydrogen')).toBe('hsl(0, 70%, 62%)')
      expect(elementToAccentColor('Iron')).toBe('hsl(138, 70%, 62%)')
      expect(elementToAccentColor('Thorium')).toBe('hsl(275, 70%, 62%)')
    })
  })
})
