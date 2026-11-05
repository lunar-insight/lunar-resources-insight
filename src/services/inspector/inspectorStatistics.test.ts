// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { LayerStats } from 'services/LayerStatsService'
import {
  barPopover,
  barPosition,
  barScale,
  binText,
  highlightText,
  cellCount,
  coveragePopover,
  coverageText,
  formatExtent,
  formatPolarExtent,
  formatValue,
  highlightedCells,
  histogramBins,
  isRanked,
  limitPopover,
  limitState,
  mergePartStatistics,
  noDataPopover,
  showsCoverage,
  skewRatio,
  spreadLabel,
  spreadPopover,
  spreadRatio,
  spreadState,
  spreadWord,
  statisticsOfSamples,
  type ClippedRange,
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
    expect(state).toMatchObject({ kind: 'spread', word: 'Uniform', median: 20, p15: 18, p85: 22, lowest: 12, highest: 28, skew: null })
  })

  it('reads low resolution below 10 cells', () => {
    expect(cellCount(41_200, 150)).toBeCloseTo(1.83, 2)
    expect(spreadState(shape(), moon, 41_200, 150)).toEqual({ kind: 'low-resolution', cellSizeKm: 150, cells: expect.closeTo(1.83, 2) })
  })

  it('leaves the slot empty without whole Moon statistics', () => {
    expect(spreadState(shape(), notLoaded, 41_200, 150)).toBeNull()
  })

  it('reads the spread when the resolution or the area is unknown', () => {
    expect(spreadState(shape(), moon, 1, undefined)?.kind).toBe('spread')
    expect(spreadState(shape(), moon, undefined, 150)?.kind).toBe('spread')
  })

  it('divides the gap between mean and median by the whole Moon width', () => {
    expect(skewRatio({ mean: 23, median: 20 }, moon)).toBeCloseTo(0.15)
    expect(skewRatio({ mean: 17, median: 20 }, moon)).toBeCloseTo(-0.15)
    expect(skewRatio({ mean: 23, median: 20 }, notLoaded)).toBeNull()
  })

  it('marks a skewed shape from 0.15 of the whole Moon width', () => {
    // Moon p15 to p85 is 20 wide, so the mark starts at a gap of 3
    expect(spreadState(shape({ mean: 23 }), moon, 1e6, 1)).toMatchObject({ skew: 'below' })
    expect(spreadState(shape({ mean: 22.99 }), moon, 1e6, 1)).toMatchObject({ skew: null })
    expect(spreadState(shape({ mean: 17 }), moon, 1e6, 1)).toMatchObject({ skew: 'above' })
    expect(spreadState(shape({ mean: 17.01 }), moon, 1e6, 1)).toMatchObject({ skew: null })
  })

  it('marks a skewed shape with the average inside Most', () => {
    expect(spreadState(shape({ mean: 21.5, median: 18, p15: 16, p85: 25 }), moon, 1e6, 1)).toMatchObject({ skew: 'below' })
  })

  it('has no skew mark without whole Moon statistics or at low resolution', () => {
    expect(spreadState(shape({ mean: 26 }), notLoaded, 1e6, 1)).toBeNull()
    expect(spreadState(shape({ mean: 26 }), moon, 41_200, 150)).toMatchObject({ kind: 'low-resolution' })
  })

  it('names the skew in the icon label', () => {
    expect(spreadLabel(spreadState(shape({ mean: 23, p85: 30 }), moon, 1e6, 1)!)).toBe('Variable, more than half below the average')
    expect(spreadLabel(spreadState(shape({ mean: 17 }), moon, 1e6, 1)!)).toBe('Uniform, more than half above the average')
    expect(spreadLabel(spreadState(shape(), moon, 1e6, 1)!)).toBe('Uniform')
    expect(spreadLabel({ kind: 'low-resolution', cellSizeKm: 150, cells: 2 })).toBe('Low resolution')
  })

  it('writes the spread popover', () => {
    const state = spreadState(shape({ mean: 23, median: 19.5, p85: 30 }), moon, 1e6, 1)!
    expect(spreadPopover(state, line)).toEqual({
      title: 'Variable',
      lines: [['Median', '19.5 wt%'], ['Most', '18.0 to 30.0 wt%'], ['Lowest', '12.0'], ['Highest', '28.0']],
      sentence: 'More than half the shape is below the average.',
    })
    const above = spreadState(shape({ mean: 17 }), moon, 1e6, 1)!
    expect(spreadPopover(above, { decimals: 0 }).sentence).toBe('More than half the shape is above the average.')
    expect(spreadPopover(above, { decimals: 0 }).lines[0]).toEqual(['Median', '20'])
    expect(spreadPopover(spreadState(shape(), moon, 1e6, 1)!, line).sentence).toBeUndefined()
  })

  it('keeps the histogram of a shape holding more than one value', () => {
    const histogram = { counts: [1, 3], edges: [12, 20, 28] }
    expect(spreadState(shape({ histogram }), moon, 1e6, 1)).toMatchObject({ mean: 20, histogram })
    const flat = { counts: [4], edges: [19.5, 20.5] }
    expect(spreadState(shape({ min: 20, max: 20, histogram: flat }), moon, 1e6, 1)).not.toHaveProperty('histogram')
    expect(spreadState(shape(), moon, 1e6, 1)).not.toHaveProperty('histogram')
  })

  it('moves Lowest and Highest to the histogram axis', () => {
    const state = spreadState(shape({ histogram: { counts: [1, 3], edges: [12, 20, 28] } }), moon, 1e6, 1)!
    expect(spreadPopover(state, line).lines).toEqual([['Median', '20.0 wt%'], ['Most', '18.0 to 22.0 wt%']])
  })

  it('writes the low resolution popover', () => {
    expect(spreadPopover({ kind: 'low-resolution', cellSizeKm: 59.6, cells: 3.4 }, line)).toEqual({
      title: 'Low resolution',
      lines: [['Cell size', '~60 km'], ['Cells here', '3']],
    })
    expect(spreadPopover({ kind: 'low-resolution', cellSizeKm: 600, cells: 0.2 }, line).lines[1]).toEqual(['Cells here', 'less than 1'])
  })
})

describe('histogram', () => {
  it('gives each bin its range and share of pixels', () => {
    expect(histogramBins({ counts: [1, 0, 3], edges: [0, 8, 16, 24] })).toEqual([
      { from: 0, to: 8, share: 25 },
      { from: 8, to: 16, share: 0 },
      { from: 16, to: 24, share: 75 },
    ])
    expect(histogramBins({ counts: [0, 0], edges: [0, 1, 2] }).map(bin => bin.share)).toEqual([0, 0])
  })

  it('writes the hover text of a bar', () => {
    expect(binText({ from: 0, to: 2, share: 36.4 }, line)).toBe('0.0 to 2.0 wt%: 36% of pixels')
    expect(binText({ from: 22, to: 24, share: 0.3 }, line)).toBe('22.0 to 24.0 wt%: less than 1% of pixels')
    expect(binText({ from: 2, to: 4, share: 0 }, { decimals: 0 })).toBe('2 to 4: 0% of pixels')
    expect(highlightText({ from: 22.8, to: 24, share: 13.2 }, line)).toBe('22.8 to 24.0 wt%: 13% of the shape')
    expect(highlightText({ from: 22, to: 24, share: 0.3 }, line)).toBe('22.0 to 24.0 wt%: <1% of the shape')
    expect(highlightText({ from: 2, to: 4, share: 0 }, { decimals: 0 })).toBe('2 to 4: <1% of the shape')
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

describe('limit', () => {
  const feo: ClippedRange = {
    range: [0, 24],
    longitudes: [-180, 60],
    notes: { high: 'Most pixels at 24 wt% lie along orbit gaps and are artifacts.' },
  }

  it('marks a point value equal to either end', () => {
    expect(limitState(24, feo, 30)).toEqual({ end: 'high', limit: 24, note: 'Most pixels at 24 wt% lie along orbit gaps and are artifacts.' })
    expect(limitState(0, feo, -120)).toEqual({ end: 'low', limit: 0, note: undefined })
    expect(limitState(23.99, feo, 30)).toBeNull()
    expect(limitState(0.01, feo, 30)).toBeNull()
  })

  it('marks only inside the clipped longitudes', () => {
    expect(limitState(24, feo, 60)).not.toBeNull()
    expect(limitState(24, feo, -180)).not.toBeNull()
    expect(limitState(24, feo, 60.5)).toBeNull()
    expect(limitState(24, { range: [0, 24] }, 120)).toMatchObject({ end: 'high' })
  })

  it('has no mark for a map not clipped', () => {
    expect(limitState(24, undefined, 30)).toBeNull()
  })

  it('writes the limit popover', () => {
    expect(limitPopover(limitState(24, feo, 30)!, line)).toEqual({
      title: "At the map's limit",
      lines: [['Limit', '24.0 wt%']],
      sentence: 'Values beyond the limit are set to it.',
      note: 'Most pixels at 24 wt% lie along orbit gaps and are artifacts.',
    })
    expect(limitPopover(limitState(0, feo, 30)!, line).note).toBeUndefined()
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

describe('mergePartStatistics', () => {
  const FINE = 1200
  const edges = Array.from({ length: FINE + 1 }, (_, i) => 2 + (i * 6) / FINE)
  const fine = (bins: Record<number, number>) => ({
    counts: Array.from({ length: FINE }, (_, i) => bins[i] ?? 0),
    edges,
  })
  const stats = (over: Partial<FeatureStatistics>): FeatureStatistics => ({
    mean: 5, median: 5, std: 0, min: 2, max: 8, p15: 2, p85: 8, count: 100, coverage: 100, ...over,
  })

  it('weights each part by the ground it holds, not by its pixels', () => {
    const merged = mergePartStatistics([
      { areaKm2: 30, stats: stats({ mean: 4, count: 900 }), fine: fine({ 0: 900 }) },
      { areaKm2: 10, stats: stats({ mean: 8, count: 10 }), fine: fine({ 1199: 10 }) },
    ], 40, 12)
    expect(merged.mean).toBe(5)
    expect(merged.count).toBe(910)
    expect(merged.coverage).toBe(100)
    const shares = merged.histogram!.counts.map(c => c / merged.histogram!.counts.reduce((a, b) => a + b, 0))
    expect(shares[0]).toBeCloseTo(0.75)
    expect(shares[11]).toBeCloseTo(0.25)
  })

  it('counts only the ground holding data', () => {
    const merged = mergePartStatistics([
      { areaKm2: 10, stats: stats({ mean: 4, coverage: 50 }), fine: fine({ 0: 1 }) },
      { areaKm2: 10, stats: stats({ mean: 8 }), fine: fine({ 1199: 1 }) },
    ], 20, 12)
    expect(merged.coverage).toBe(75)
    expect(merged.mean).toBeCloseTo((5 * 4 + 10 * 8) / 15)
  })

  it('pools the spread within and between parts', () => {
    const merged = mergePartStatistics([
      { areaKm2: 10, stats: stats({ mean: 4, std: 1 }), fine: fine({ 0: 1 }) },
      { areaKm2: 10, stats: stats({ mean: 6, std: 1 }), fine: fine({ 1199: 1 }) },
    ], 20, 12)
    expect(merged.std).toBeCloseTo(Math.sqrt(2))
  })

  it('takes the extremes of both parts', () => {
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({ min: 2, max: 5 }), fine: fine({ 0: 1 }) },
      { areaKm2: 1, stats: stats({ min: 4, max: 8 }), fine: fine({ 1199: 1 }) },
    ], 2, 12)
    expect([merged.min, merged.max]).toEqual([2, 8])
  })

  it('reads the median and percentiles from the merged histogram', () => {
    // 100 units evenly over the first half of the range in one part, the second half in the other
    const half = (from: number) => Object.fromEntries(Array.from({ length: 600 }, (_, i) => [from + i, 1]))
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({}), fine: fine(half(0)) },
      { areaKm2: 1, stats: stats({}), fine: fine(half(600)) },
    ], 2, 12)
    expect(merged.median).toBeCloseTo(5, 6)
    expect(merged.p15).toBeCloseTo(2.9, 6)
    expect(merged.p85).toBeCloseTo(7.1, 6)
  })

  it('stays within the extremes for a shape holding one value', () => {
    const narrow = Array.from({ length: FINE + 1 }, (_, i) => 4.5 + i / FINE)
    const one = { counts: Array.from({ length: FINE }, (_, i) => (i === 600 ? 1 : 0)), edges: narrow }
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({ min: 5, max: 5 }), fine: one },
      { areaKm2: 1, stats: stats({ min: 5, max: 5 }), fine: one },
    ], 2, 12)
    expect([merged.p15, merged.median, merged.p85]).toEqual([5, 5, 5])
  })

  it('groups the fine bins into the bins shown, edges included', () => {
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({}), fine: fine({ 0: 1, 99: 1, 100: 2 }) },
      { areaKm2: 1, stats: stats({}), fine: fine({ 1199: 4 }) },
    ], 2, 12)
    const { counts, edges: shown } = merged.histogram!
    expect(counts).toHaveLength(12)
    expect(shown).toHaveLength(13)
    expect(shown[0]).toBe(2)
    expect(shown[1]).toBeCloseTo(2.5)
    expect(shown[12]).toBe(8)
    expect(counts[0]).toBeCloseTo(counts[1])
    expect(counts[11]).toBeCloseTo(counts[0] * 2)
  })

  it('reads a part with an empty histogram as holding no bars', () => {
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({ mean: 4 }), fine: fine({}) },
      { areaKm2: 1, stats: stats({ mean: 6 }), fine: fine({ 600: 1 }) },
    ], 2, 12)
    expect(merged.mean).toBe(5)
    expect(merged.histogram!.counts.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
  })

  it('falls to the top of the range when no bar holds anything', () => {
    const merged = mergePartStatistics([
      { areaKm2: 1, stats: stats({}), fine: fine({}) },
      { areaKm2: 1, stats: stats({}), fine: fine({}) },
    ], 2, 12)
    expect(merged.median).toBe(8)
  })
})

describe('formatValue', () => {
  it('fixes decimals and groups thousands', () => {
    expect(formatValue(2100.4, 0)).toBe('2,100')
    expect(formatValue(0.834, 2)).toBe('0.83')
    expect(formatValue(4, 1)).toBe('4.0')
  })
})
