// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { LayersConfig } from 'types/layers'
import {
  buildInspectorLines,
  groupInspectorLines,
  fileForLatitude,
  allLineFiles,
  displayUnit,
  inspectorLines,
  inspectorGroups,
  filterGroups,
  lineCount,
} from './inspectorLayers'

const config: LayersConfig = {
  layers: {
    basemap: { filename: 'base.tif', category: 'basemap' },
    th_a: {
      filename: 'th_a_fine.tif', category: 'chemical', element: 'thorium', units: 'ppm',
      datasetLabel: 'LP GRS', datasetShort: 'LP GRS', decimals: 1, stac: 'fine.json',
      variants: [
        { label: '0.5°', filename: 'th_a_fine.tif', stac: 'fine.json' },
        { label: '5°', filename: 'th_a_coarse.tif', stac: 'coarse.json' },
      ],
    },
    th_count: { filename: 'th_count.tif', category: 'chemical', element: 'thorium', units: 'count_rate' },
    feo: { filename: 'feo.tif', category: 'compound', compound: 'feo', units: 'wt% FeO', datasetLabel: 'LP GRS' },
    th_b: { filename: 'th_b.tif', category: 'chemical', element: 'thorium', units: 'ppm', datasetLabel: 'Kaguya GRS' },
    pl_north: {
      filename: 'pl_n.tif', category: 'mineral', mineral: 'plagioclase', units: 'wt%',
      datasetLabel: 'Kaguya SP, poles', inspectorPair: 'pl_sp', decimals: 0,
    },
    pl_south: {
      filename: 'pl_s.tif', category: 'mineral', mineral: 'plagioclase', units: 'wt%',
      datasetLabel: 'Kaguya SP, poles', inspectorPair: 'pl_sp', decimals: 0,
    },
    mg_number: { filename: 'mg.tif', category: 'derived-index', units: 'Mg# (0 to 100)' },
    off: { filename: 'off.tif', category: 'chemical', element: 'iron', available: false },
  },
}

describe('buildInspectorLines', () => {
  const lines = buildInspectorLines(config)

  it('lists resource layers in config order, without count rates', () => {
    expect(lines.map(line => line.id)).toEqual(['th_a', 'feo', 'th_b', 'pl_sp', 'mg_number'])
  })

  it('reads the first variant and names it', () => {
    const th = lines[0]
    expect(th.files).toEqual([{ layerId: 'th_a', filename: 'th_a_fine.tif', stac: 'fine.json' }])
    expect(th.variantLabel).toBe('0.5°')
    expect(th.symbol).toBe('Th')
    expect(th.cardName).toBe('Thorium')
    expect(th.decimals).toBe(1)
    expect(th.referenceRange).toEqual({ min: 0, max: 14 })
  })

  it('forms one line from a polar pair, one file per side', () => {
    const pair = lines.find(line => line.id === 'pl_sp')!
    expect(pair.files.map(file => [file.layerId, file.side])).toEqual([['pl_north', 'north'], ['pl_south', 'south']])
    expect(pair.symbol).toBe('Pl')
    expect(pair.cardName).toBe('Plagioclase')
  })

  it('falls back on defaults for missing fields', () => {
    const feo = lines.find(line => line.id === 'feo')!
    expect(feo.unit).toBe('wt%')
    expect(feo.decimals).toBe(2)
    expect(feo.datasetShort).toBe('LP GRS')
    expect(feo.cardName).toBe('Iron oxide')
    const mg = lines.find(line => line.id === 'mg_number')!
    expect(mg.symbol).toBe('Mg#')
    expect(mg.unit).toBe('index')
    expect(mg.referenceRange).toEqual({ min: 0, max: 100 })
    expect(mg.scaleLabels).toEqual({ low: 'Mare', high: 'Highland' })
    expect(feo.scaleLabels).toBeUndefined()
  })
})

describe('groupInspectorLines', () => {
  it('groups lines into cards by category, then symbol', () => {
    const groups = groupInspectorLines(buildInspectorLines(config))
    expect(groups.map(group => group.category)).toEqual(['chemical', 'compound', 'mineral', 'derived-index'])
    expect(groups[0].cards).toHaveLength(1)
    expect(groups[0].cards[0].lines.map(line => line.id)).toEqual(['th_a', 'th_b'])
  })
})

describe('fileForLatitude', () => {
  const pair = buildInspectorLines(config).find(line => line.id === 'pl_sp')!

  it('reads the north file from 0° up, the south file below', () => {
    expect(fileForLatitude(pair, 0).layerId).toBe('pl_north')
    expect(fileForLatitude(pair, 72).layerId).toBe('pl_north')
    expect(fileForLatitude(pair, -0.1).layerId).toBe('pl_south')
  })

  it('reads the only file of a single line', () => {
    const line = buildInspectorLines(config)[0]
    expect(fileForLatitude(line, -80).filename).toBe('th_a_fine.tif')
  })
})

describe('displayUnit', () => {
  it('maps units to wt%, ppm and index', () => {
    expect(displayUnit({ filename: '', category: 'compound', units: 'wt% FeO' })).toBe('wt%')
    expect(displayUnit({ filename: '', category: 'chemical', units: 'ppm' })).toBe('ppm')
    expect(displayUnit({ filename: '', category: 'derived-index', units: 'Mg# (0 to 100)' })).toBe('index')
    expect(displayUnit({ filename: '', category: 'chemical' })).toBeUndefined()
  })
})

describe('the app layer list', () => {
  it('gives 46 lines in 25 cards', () => {
    expect(inspectorLines).toHaveLength(46)
    expect(inspectorGroups.flatMap(group => group.cards)).toHaveLength(25)
  })

  it('reads 50 files', () => {
    expect(allLineFiles(inspectorLines)).toHaveLength(50)
  })

  it('scales Si, Al, O and Na by percentile, every other line by a reference range', () => {
    const percentile = [...new Set(inspectorLines.filter(line => !line.referenceRange).map(line => line.symbol))]
    expect(percentile).toEqual(['Si', 'O', 'Al', 'Na'])
    expect(inspectorLines.find(line => line.id === 'potassium_kaguya_grs')!.referenceRange).toEqual({ min: 0, max: 4800 })
  })

  it('names elements with IUPAC spelling', () => {
    const al = inspectorGroups[0].cards.find(card => card.symbol === 'Al')!
    expect(al.name).toBe('Aluminium')
  })
})

describe('filterGroups', () => {
  const groups = groupInspectorLines(buildInspectorLines(config))

  it('returns every group without a query', () => {
    expect(filterGroups(groups, '  ')).toBe(groups)
  })

  it('keeps a whole card on a symbol or name match, case insensitive', () => {
    const result = filterGroups(groups, 'THORIUM')
    expect(result).toHaveLength(1)
    expect(result[0].cards[0].lines).toHaveLength(2)
    expect(filterGroups(groups, 'pl')[0].cards[0].symbol).toBe('Pl')
  })

  it('keeps only the matching lines on a dataset or variant match', () => {
    const byDataset = filterGroups(groups, 'kaguya grs')
    expect(byDataset[0].cards[0].lines.map(line => line.id)).toEqual(['th_b'])
    const byVariant = filterGroups(groups, '0.5°')
    expect(byVariant[0].cards[0].lines.map(line => line.id)).toEqual(['th_a'])
  })

  it('drops groups with no line left and counts the visible lines', () => {
    const result = filterGroups(groups, 'lp grs')
    expect(result.map(group => group.category)).toEqual(['chemical', 'compound'])
    expect(lineCount(result[0])).toBe(1)
    expect(filterGroups(groups, 'nothing')).toEqual([])
  })
})
