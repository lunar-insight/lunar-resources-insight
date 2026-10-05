import { describe, it, expect, vi } from 'vitest'
import * as Cesium from 'cesium'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import type { InspectorLine } from './inspectorLayers'
import type { FeatureResults } from './InspectorStore'
import {
  comparisonCsv,
  csvFileName,
  downloadCsv,
  profileCsv,
  profileHeading,
  statisticsCsv,
  toCsv,
} from './inspectorCsv'

const line = (id: string, overrides: Partial<InspectorLine> = {}): InspectorLine => ({
  id, symbol: 'FeO', cardName: 'Iron oxide', category: 'compound',
  datasetLabel: 'Clementine CNN (Qiu 2025)', datasetShort: 'Clementine',
  unit: 'wt%', decimals: 1, files: [{ layerId: id, filename: `${id}.tif` }],
  ...overrides,
})

const lines = [line('feo'), line('th', { symbol: 'Th', cardName: 'Thorium', datasetLabel: 'LP GRS', variantLabel: '0.5° low-alt', unit: 'ppm' })]
const file = { layerId: 'x', filename: 'x.tif' }

const results = (kind: FeatureResults['kind'], overrides: Partial<FeatureResults> = {}): FeatureResults => ({
  featureId: 'f', geometryKey: 'k', kind, status: 'ready', done: 2, total: 2, failedRequests: 0,
  lines: {
    feo: {
      file, value: 15.8,
      stats: { mean: 15.8, median: 15.5, std: 1.7, min: 10, max: 20, p15: 14, p85: 17, count: 576, coverage: 97.5 },
    },
    th: { file, noData: 'outside', extent: '50°N to 50°S' },
  },
  ...overrides,
})

const rows = (csv: string) => csv.trimEnd().split('\r\n')

describe('toCsv', () => {
  it('quotes cells holding commas, quotes or line breaks, and leaves blanks for missing values', () => {
    expect(toCsv([['a,b', 'say "hi"', 'x\ny', null, undefined, NaN, 2.5]]))
      .toBe('"a,b","say ""hi""","x\ny",,,,2.5\r\n')
  })
})

describe('statisticsCsv', () => {
  it('writes one row per dataset line with the full statistics', () => {
    const [header, feo, th] = rows(statisticsCsv(lines, results('shape')))
    expect(header).toBe('Symbol,Name,Dataset,Variant,Unit,Status,Average,Median,Std dev,Lowest,Highest,P15,P85,Count,Coverage (%),Read at')
    expect(feo).toBe('FeO,Iron oxide,Clementine CNN (Qiu 2025),,wt%,ok,15.8,15.5,1.7,10,20,14,17,576,97.5,overview capped at 1024 px')
    expect(th).toBe('Th,Thorium,LP GRS,0.5° low-alt,ppm,no data,,,,,,,,,,')
  })

  it('marks a point as read at full resolution, and failed or missing lines', () => {
    const csv = statisticsCsv(lines, results('point', {
      lines: { feo: { file, value: 3 }, th: { file, failed: true } },
    }))
    const [, feo, th] = rows(csv)
    expect(feo.endsWith(',3,,,,,,,,,full resolution')).toBe(true)
    expect(th).toContain(',failed,')
    expect(rows(statisticsCsv(lines, results('point', { lines: {} })))[1]).toContain(',not computed,')
  })

  it('counts the samples of a line', () => {
    const csv = statisticsCsv([lines[0]], results('line', {
      lines: { feo: { file, value: 2, profile: [1, 3, null] } },
    }))
    expect(rows(csv)[1].endsWith(',3 point samples')).toBe(true)
  })
})

describe('profileCsv', () => {
  it('writes one row per sample, one column per dataset line', () => {
    const csv = profileCsv(lines, results('line', {
      samples: [{ distanceKm: 0, lat: 38.1, lon: -21.4 }, { distanceKm: 3.2, lat: 38, lon: -21.3 }],
      lines: { feo: { file, value: 2, profile: [1.5, null] }, th: { file, noData: 'outside' } },
    }))
    expect(rows(csv)).toEqual([
      'Distance (km),Latitude,Longitude,FeO · Clementine CNN (Qiu 2025) (wt%),Th · LP GRS · 0.5° low-alt (ppm)',
      '0,38.1,-21.4,1.5,',
      '3.2,38,-21.3,,',
    ])
  })

  it('writes the heading without a unit when the layer has none', () => {
    expect(profileHeading(line('t', { symbol: 'Th', datasetLabel: 'LP GRS', unit: undefined }))).toBe('Th · LP GRS')
  })

  it('writes the header alone without samples', () => {
    expect(rows(profileCsv(lines, results('line')))).toHaveLength(1)
  })
})

describe('comparisonCsv', () => {
  it('writes the statistics of every feature, one row per feature and line', () => {
    const feature = (name: string, type: Feature['type']) => ({
      id: name, type, name, entity: {} as Cesium.Entity, color: '#fff',
      metadata: { createdAt: new Date(0) }, inspectorOpen: false, visible: true,
    }) as Feature
    const csv = comparisonCsv(lines, [
      { feature: feature('Crisium', 'three-point-circle'), results: results('shape') },
      { feature: feature('Pending', 'point') },
    ])
    const all = rows(csv)
    expect(all[0].startsWith('Feature,Type,Symbol,')).toBe(true)
    expect(all).toHaveLength(5)
    expect(all[1].startsWith('Crisium,circle,FeO,')).toBe(true)
    expect(all[3]).toContain('Pending,point,FeO,Iron oxide,Clementine CNN (Qiu 2025),,wt%,not computed')
  })
})

describe('csvFileName', () => {
  it('builds a file name from the feature name', () => {
    expect(csvFileName('Schrödinger basin', 'statistics')).toBe('schrodinger-basin-statistics.csv')
    expect(csvFileName('***', 'profile')).toBe('feature-profile.csv')
  })
})

describe('downloadCsv', () => {
  it('saves the text through a temporary link', () => {
    const createObjectURL = vi.fn(() => 'blob:csv')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    downloadCsv('a.csv', 'x\r\n')

    expect(click).toHaveBeenCalledTimes(1)
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:csv')
    expect(document.querySelector('a[download]')).toBeNull()
    vi.unstubAllGlobals()
  })
})
