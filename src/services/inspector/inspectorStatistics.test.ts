// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { LayerStats } from 'services/LayerStatsService'
import {
  barPopover,
  barPosition,
  barScale,
  cellCount,
  coveragePopover,
  coverageText,
  formatExtent,
  formatPolarExtent,
  formatValue,
  highlightedCells,
  isRanked,
  noDataPopover,
  showsCoverage,
  spreadPopover,
  spreadRatio,
  spreadState,
  spreadWord,
  statisticsOfSamples,
  type FeatureStatistics,
} from './inspectorStatistics'

const moon: LayerStats = {
  min: 0, max: 100,
  percentile_2: 2, percentile_15: 10, percentile_85: 30, percentile_95: 60, percentile_98: 80,
  loaded: true,
}
const notLoaded: LayerStats = { min: 0, max: 100, loaded: false }

const shape = (overrides: Partial<FeatureStatistics> = {}): FeatureStatistics => ({
  mean: 20, median: 20, std: 2, min: 12, max: 28, p15: 18, p85: 22, count: 100, coverage: 100,
  ...overrides,
})

const line = { decimals: 1, unit: 'wt%' }

describe('spread', () => {
  it('divides the shape width by the whole Moon width', () => {
    expect(spreadRatio({ p15: 18, p85: 22 }, moon)).toBeCloseTo(0.2)
    expect(spreadRatio({ p15: 18, p85: 22 }, notLoaded)).toBeNull()
    expect(spreadRatio({ p15: 18, p85: 22 }, { ...moon, percentile_85: 10 })).toBeNull()
  })

  it('names the ratio with the thresholds', () => {
    expect(spreadWord(0.02)).toBe('Uniform')
    expect(spreadWord(0.349)).toBe('Uniform')
    expect(spreadWord(0.35)).toBe('Variable')
    expect(spreadWord(0.749)).toBe('Variable')
    expect(spreadWord(0.75)).toBe('Highly variable')
    expect(spreadWord(1.73)).toBe('Highly variable')
  })

  it('reads the spread when the shape holds enough native cells', () => {
    const state = spreadState(shape(), moon, 41_200, 45)
    expect(state).toMatchObject({ kind: 'spread', word: 'Uniform', p15: 18, p85: 22, lowest: 12, highest: 28, pulled: null })
  })

  it('reads low resolution below 10 cells', () => {
    expect(cellCount(41_200, 150)).toBeCloseTo(1.83, 2)
    expect(spreadState(shape(), moon, 41_200, 150)).toEqual({ kind: 'low-resolution', cellSizeKm: 150, cells: expect.closeTo(1.83, 2) })
  })

  it('leaves the slot empty without whole Moon statistics', () => {
    expect(spreadState(shape(), notLoaded, 41_200, 150)).toBeNull()
  })

  it('reads the spread when the resolution is unknown', () => {
    expect(spreadState(shape(), moon, 1, undefined)?.kind).toBe('spread')
  })

  it('says which way an average outside Most is pulled', () => {
    expect(spreadState(shape({ mean: 17 }), moon, 1e6, 1)).toMatchObject({ pulled: 'down' })
    expect(spreadState(shape({ mean: 23 }), moon, 1e6, 1)).toMatchObject({ pulled: 'up' })
  })

  it('writes the spread popover', () => {
    const state = spreadState(shape({ mean: 17, p85: 30 }), moon, 1e6, 1)!
    expect(spreadPopover(state, line)).toEqual({
      title: 'Variable',
      lines: [['Most', '18.0 to 30.0 wt%'], ['Lowest', '12.0'], ['Highest', '28.0']],
      sentence: 'Pulled down by a few low values.',
    })
    const up = spreadState(shape({ mean: 23 }), moon, 1e6, 1)!
    expect(spreadPopover(up, { decimals: 0 }).sentence).toBe('Pulled up by a few high values.')
    expect(spreadPopover(spreadState(shape(), moon, 1e6, 1)!, line).sentence).toBeUndefined()
  })

  it('writes the low resolution popover', () => {
    expect(spreadPopover({ kind: 'low-resolution', cellSizeKm: 59.6, cells: 3.4 }, line)).toEqual({
      title: 'Low resolution',
      lines: [['Cell size', '~60 km'], ['Cells here', '3']],
    })
    expect(spreadPopover({ kind: 'low-resolution', cellSizeKm: 600, cells: 0.2 }, line).lines[1]).toEqual(['Cells here', 'less than 1'])
  })
})

describe('coverage', () => {
  it('shows below 95% only', () => {
    expect(showsCoverage(94.9)).toBe(true)
    expect(showsCoverage(95)).toBe(false)
    expect(showsCoverage(undefined)).toBe(false)
  })

  it('ranks from 50%', () => {
    expect(isRanked(50)).toBe(true)
    expect(isRanked(49.9)).toBe(false)
    expect(isRanked(undefined)).toBe(true)
  })

  it('writes the popover in the window and in the comparison', () => {
    expect(coverageText(70.6)).toBe('71%')
    expect(coveragePopover(71)).toEqual({
      title: 'Partial data',
      lines: [['Covered', '71% of the area']],
      sentence: 'The average uses that part only.',
    })
    expect(coveragePopover(42, true).sentence).toBe('The average uses that part only, so it is not ranked.')
    expect(coveragePopover(71, true).sentence).toBe('The average uses that part only.')
  })
})

describe('bar scale', () => {
  it('uses the reference range when one exists', () => {
    const scale = barScale({ referenceRange: { min: 0, max: 25 } }, notLoaded)
    expect(scale).toEqual({ kind: 'reference', min: 0, max: 25 })
    expect(barPosition(scale, 5)).toBeCloseTo(0.2)
    expect(barPosition(scale, 40)).toBe(1)
    expect(barPosition(scale, -1)).toBe(0)
    expect(barPosition({ kind: 'reference', min: 1, max: 1 }, 1)).toBe(0)
    expect(barPopover(scale, 5, line)).toEqual({ title: 'Reference range', lines: [['Range', '0.0 to 25.0 wt%']] })
  })

  it('says what low and high values mean for a derived index', () => {
    const scale = barScale({ referenceRange: { min: 0, max: 100 } }, notLoaded)
    expect(barPopover(scale, 54, { decimals: 0, unit: 'index', scaleLabels: { low: 'Mare', high: 'Highland' } })).toEqual({
      title: 'Reference range',
      lines: [['Range', '0 to 100 index'], ['Low', 'Mare'], ['High', 'Highland']],
    })
  })

  it('explains a value below 0 as counting noise', () => {
    const reference = barScale({ referenceRange: { min: 0, max: 32 } }, notLoaded)
    expect(barPosition(reference, -3.8)).toBe(0)
    expect(barPopover(reference, -3.8, { decimals: 1, unit: 'ppm' })).toEqual({
      title: 'Reference range',
      lines: [['Range', '0.0 to 32.0 ppm']],
      sentence: 'Below 0 from counting noise: the abundance is close to 0.',
    })
    expect(barPopover(reference, 0, { decimals: 1, unit: 'ppm' }).sentence).toBeUndefined()

    const percentile = barScale({}, { ...moon, min: -4, percentile_2: -3 })
    expect(barPopover(percentile, -3.5, line).sentence)
      .toBe('Higher than 1% of this dataset. Below 0 from counting noise: the abundance is close to 0.')
  })

  it('uses the percentile otherwise', () => {
    const scale = barScale({}, moon)
    expect(scale.kind).toBe('percentile')
    expect(barPosition(scale, 20)).toBeCloseTo(0.5)
    expect(barPopover(scale, 20, line)).toEqual({ title: 'Percentile', lines: [], sentence: 'Higher than 50% of this dataset.' })
  })

  it('has no scale without a range or statistics', () => {
    const scale = barScale({}, notLoaded)
    expect(scale).toEqual({ kind: 'none' })
    expect(barPosition(scale, 3)).toBe(0)
    expect(barPopover(scale, 3, line).title).toBe('Scale unavailable')
  })
})

describe('no data', () => {
  it('gives the extent outside the dataset', () => {
    expect(noDataPopover('outside', '50°N to 50°S').sentence).toBe('This dataset covers 50°N to 50°S.')
    expect(noDataPopover('inside').sentence).toBe('This dataset has no measurements at this location.')
    expect(noDataPopover('outside').sentence).toBe('This dataset has no measurements at this location.')
  })

  it('writes extents', () => {
    expect(formatExtent([-180, -50, 180, 50])).toBe('50°N to 50°S')
    expect(formatExtent([-178.6, -88.1, 179.9, 87.2])).toBe('87°N to 88°S')
    expect(formatExtent([-10, 0.2, 20.4, 30])).toBe('30°N to 0°, -10° to 20° longitude')
    expect(formatPolarExtent([[-180, 49.8, 180, 90], [-180, -90, 180, -49.8]])).toBe('the poles, from 50° latitude')
  })
})

describe('highlightedCells', () => {
  it('marks the highest ranked value', () => {
    expect(highlightedCells([{ value: 1 }, { value: 3, coverage: 80 }, null])).toEqual(new Set([1]))
  })

  it('skips cells under 50% coverage', () => {
    expect(highlightedCells([{ value: 9, coverage: 42 }, { value: 3 }, { value: 2 }])).toEqual(new Set([1]))
  })

  it('needs two ranked cells', () => {
    expect(highlightedCells([{ value: 9, coverage: 42 }, { value: 3 }])).toEqual(new Set())
  })

  it('marks every tie', () => {
    expect(highlightedCells([{ value: 3 }, { value: 3 }])).toEqual(new Set([0, 1]))
  })
})

describe('statisticsOfSamples', () => {
  it('computes statistics over the samples holding data', () => {
    const stats = statisticsOfSamples([1, 2, null, 3, 4, 5, null, null, null, null])!
    expect(stats.mean).toBe(3)
    expect(stats.median).toBe(3)
    expect(stats.min).toBe(1)
    expect(stats.max).toBe(5)
    expect(stats.p15).toBeCloseTo(1.6)
    expect(stats.p85).toBeCloseTo(4.4)
    expect(stats.std).toBeCloseTo(Math.sqrt(2))
    expect(stats.count).toBe(5)
    expect(stats.coverage).toBe(50)
  })

  it('returns null without data', () => {
    expect(statisticsOfSamples([null, null])).toBeNull()
    expect(statisticsOfSamples([])).toBeNull()
  })
})

describe('formatValue', () => {
  it('fixes decimals and groups thousands', () => {
    expect(formatValue(2100.4, 0)).toBe('2,100')
    expect(formatValue(0.834, 2)).toBe('0.83')
    expect(formatValue(4, 1)).toBe('4.0')
  })
})
