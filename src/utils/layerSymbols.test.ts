// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  elementDisplayName,
  getCompoundSymbol,
  getElementSymbol,
  getMineralSymbol,
  layerSymbol,
  layerSymbolName,
} from './layerSymbols'

describe('symbols', () => {
  it('finds elements in every block of the periodic table', () => {
    expect(getElementSymbol('iron')).toBe('Fe')
    expect(getElementSymbol('samarium')).toBe('Sm')
    expect(getElementSymbol('Thorium')).toBe('Th')
    expect(getElementSymbol('unknownium')).toBe('UN')
  })

  it('resolves compounds and minerals, with fallbacks', () => {
    expect(getCompoundSymbol('tio2')).toBe('TiO₂')
    expect(getCompoundSymbol('xyz')).toBe('XYZ')
    expect(getMineralSymbol('orthopyroxene')).toBe('Opx')
    expect(getMineralSymbol('garnet')).toBe('gar')
  })

  it('names elements with IUPAC spelling', () => {
    expect(elementDisplayName('aluminum')).toBe('Aluminium')
    expect(elementDisplayName('cesium')).toBe('Caesium')
    expect(elementDisplayName('sulfur')).toBe('Sulfur')
    expect(elementDisplayName('unknownium')).toBe('unknownium')
  })
})

describe('layerSymbol and layerSymbolName', () => {
  it('cover each layer category', () => {
    const compound = { filename: '', category: 'compound' as const, compound: 'feo' }
    const mineral = { filename: '', category: 'mineral' as const, mineral: 'olivine' }
    const derived = { filename: '', category: 'derived-index' as const }
    const element = { filename: '', category: 'chemical' as const, element: 'aluminum' }
    const bare = { filename: '', category: 'chemical' as const }

    expect([layerSymbol('x', compound), layerSymbolName('x', compound)]).toEqual(['FeO', 'Iron oxide'])
    expect([layerSymbol('x', mineral), layerSymbolName('x', mineral)]).toEqual(['Ol', 'Olivine'])
    expect([layerSymbol('mg_number', derived), layerSymbolName('mg_number', derived)]).toEqual(['Mg#', 'Magnesium Number'])
    expect([layerSymbol('other', derived), layerSymbolName('other', derived)]).toEqual(['other', 'other'])
    expect([layerSymbol('x', element), layerSymbolName('x', element)]).toEqual(['Al', 'Aluminium'])
    expect([layerSymbol('bare', bare), layerSymbolName('bare', bare)]).toEqual(['bare', 'bare'])
  })
})
