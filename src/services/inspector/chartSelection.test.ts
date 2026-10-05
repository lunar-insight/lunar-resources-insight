// @vitest-environment node
import { describe, it, expect } from 'vitest'
import {
  MAX_CHART_LAYERS,
  SERIES_COLORS,
  colorOf,
  isPicked,
  isUnitFull,
  picksIn,
  togglePick,
  type ChartSelection,
} from './chartSelection'

const empty: ChartSelection = { picks: [], unit: 'wt%' }

describe('togglePick', () => {
  it('adds a layer with the first free color of its unit and shows its chart', () => {
    let selection = togglePick(empty, 'feo', 'wt%')
    selection = togglePick(selection, 'th', 'ppm')
    expect(selection.unit).toBe('ppm')
    expect(colorOf(selection, 'feo')).toBe(SERIES_COLORS[0])
    expect(colorOf(selection, 'th')).toBe(SERIES_COLORS[0])
    expect(colorOf(selection, 'none')).toBeUndefined()
  })

  it('keeps colors when a layer is removed, and reuses the freed one', () => {
    let selection = ['a', 'b', 'c'].reduce((s, id) => togglePick(s, id, 'wt%'), empty)
    selection = togglePick(selection, 'b', 'wt%')
    expect(isPicked(selection, 'b')).toBe(false)
    expect(colorOf(selection, 'c')).toBe(SERIES_COLORS[2])

    selection = togglePick(selection, 'd', 'wt%')
    expect(colorOf(selection, 'd')).toBe(SERIES_COLORS[1])
  })

  it('takes no more than 8 layers per unit', () => {
    const full = Array.from({ length: MAX_CHART_LAYERS }, (_, i) => `l${i}`)
      .reduce((s, id) => togglePick(s, id, 'wt%'), empty)
    expect(isUnitFull(full, 'wt%')).toBe(true)
    expect(togglePick(full, 'extra', 'wt%')).toBe(full)
    expect(isUnitFull(full, 'ppm')).toBe(false)
    expect(picksIn(togglePick(full, 'th', 'ppm'), 'ppm')).toHaveLength(1)
  })
})
