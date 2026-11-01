// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { barView, fullLineName, pointLimit } from './lineView'
import { inspectorLines } from 'services/inspector/inspectorLayers'
import { makeResults, moonStats } from './inspectorTestUtils'

const withRange = inspectorLines.find(line => line.referenceRange)!
const withoutRange = inspectorLines.find(line => !line.referenceRange)!
const file = withRange.files[0]
const notLoaded = { min: 0, max: 100, loaded: false }

describe('barView', () => {
  it('places a value on the reference range', () => {
    const view = barView(withRange, { file, value: withRange.referenceRange!.max / 2 }, notLoaded)
    expect(view).toMatchObject({ kind: 'value', position: 0.5, popover: { title: 'Reference range' } })
  })

  it('places a value on the percentile without a range', () => {
    expect(barView(withoutRange, { file, value: 20 }, moonStats)).toMatchObject({ kind: 'value', position: 0.5, popover: { title: 'Percentile' } })
  })

  it('has no scale without a range or statistics', () => {
    expect(barView(withoutRange, { file, value: 20 }, notLoaded).kind).toBe('no-scale')
  })

  it('reads no data with its extent', () => {
    expect(barView(withRange, { file, noData: 'outside', extent: '50°N to 50°S' }, moonStats)).toMatchObject({
      kind: 'no-data', popover: { sentence: 'This dataset covers 50°N to 50°S.' },
    })
  })

  it('reads a failed or missing value as not computed', () => {
    expect(barView(withRange, { file, failed: true }, moonStats).kind).toBe('failed')
    expect(barView(withRange, { file }, moonStats).kind).toBe('failed')
  })
})

describe('pointLimit', () => {
  const clip = { range: [0, 24] as [number, number] }
  const point = makeResults('point', {}, { center: { lon: 30, lat: 10 } })

  it('marks a point value at a limit', () => {
    expect(pointLimit({ file, value: 24, clip }, point)).toMatchObject({ end: 'high', limit: 24 })
  })

  it('has no mark without a value', () => {
    expect(pointLimit({ file, noData: 'inside', clip }, point)).toBeNull()
    expect(pointLimit({ file, noData: 'outside', extent: '50°N to 50°S', clip }, point)).toBeNull()
    expect(pointLimit({ file, failed: true, clip }, point)).toBeNull()
  })

  it('has no mark without a center or outside a point', () => {
    expect(pointLimit({ file, value: 24, clip }, { ...point, center: undefined })).toBeNull()
    expect(pointLimit({ file, value: 24, clip }, makeResults('shape', {}, { center: { lon: 30, lat: 10 } }))).toBeNull()
  })
})

describe('fullLineName', () => {
  it('joins the card name, dataset and variant', () => {
    const th = inspectorLines.find(line => line.id === 'thorium_grs')!
    expect(fullLineName(th)).toBe('Thorium · LP GRS · 0.5° low-alt')
  })
})
