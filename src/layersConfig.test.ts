// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { layersConfig } from './layersConfig'

const STAC_ROOT = fileURLToPath(new URL('../public/stac/', import.meta.url))

function resolutionKm(stac: string): number {
  const item = JSON.parse(readFileSync(STAC_ROOT + stac, 'utf8'))
  return item.properties['lri:resolution_km']
}

const layersWithVariants = Object.entries(layersConfig.layers)
  .filter(([, config]) => config.variants?.length)

// The first variant is the default read wherever one file per layer is used, so it must be the finest.
// Variants after the first are in no particular order.
describe('layer variants', () => {
  it.each(layersWithVariants)('%s lists its finest variant first', (_, config) => {
    const resolutions = config.variants.map(v => resolutionKm(v.stac))

    resolutions.forEach(km => expect(km).toBeTypeOf('number'))
    expect(resolutions[0]).toBe(Math.min(...resolutions))
  })
})

const RESOURCE_CATEGORIES = ['chemical', 'compound', 'mineral', 'derived-index']
const inspectorLayers = Object.entries(layersConfig.layers)
  .filter(([, config]) => RESOURCE_CATEGORIES.includes(config.category) && config.units !== 'count_rate')

// The Inspector lists every resource layer except count rates, as one line each.
describe('Inspector fields', () => {
  it.each(inspectorLayers)('%s names its dataset, unit and decimals', (_, config) => {
    expect(config.units).toBeTruthy()
    expect(config.datasetLabel).toBeTruthy()
    expect(config.datasetShort).toBeTruthy()
    expect(Number.isInteger(config.decimals)).toBe(true)
  })

  it.each(inspectorLayers)('%s states the resolution of the file the Inspector reads', (_, config) => {
    expect(resolutionKm(config.variants?.[0]?.stac ?? config.stac)).toBeTypeOf('number')
  })

  it('pairs each polar file with the file of the other pole', () => {
    const pairs = new Map<string, string[]>()
    inspectorLayers.forEach(([id, config]) => {
      if (config.inspectorPair) pairs.set(config.inspectorPair, [...(pairs.get(config.inspectorPair) ?? []), id])
    })

    expect(pairs.size).toBe(4)
    pairs.forEach(ids => {
      expect(ids).toHaveLength(2)
      expect(ids.filter(id => id.includes('north'))).toHaveLength(1)
      expect(ids.filter(id => id.includes('south'))).toHaveLength(1)
      const [a, b] = ids.map(id => layersConfig.layers[id])
      expect([a.datasetLabel, a.units, a.decimals, a.mineral]).toEqual([b.datasetLabel, b.units, b.decimals, b.mineral])
    })
  })
})
