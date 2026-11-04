import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'

const fullTable = Object.fromEntries(Array.from({ length: 256 }, (_, i) => [String(i), [i, 255 - i, 7, 255]]))

const responses = vi.hoisted(() => ({ byName: {} as Record<string, unknown> }))

vi.mock('../geoConfigExporter', () => ({
  colormapCategories: { Test: ['viridis', 'short', 'badentry', 'failing'] },
  fetchColormapData: async (name: string) => {
    const response = responses.byName[name]
    if (response instanceof Error) throw response
    return response
  },
  buildGradientPreviewUrl: (name: string) => `/colorMaps/${name}?f=png`,
}))

import { colormapService } from './ColormapService'

describe('ColormapService tables', () => {
  beforeAll(async () => {
    responses.byName = {
      viridis: fullTable,
      short: { 0: [1, 2, 3, 255] },
      badentry: { ...fullTable, 100: [1, 2, 3] },
      failing: new Error('HTTP 500'),
    }
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubGlobal('Image', class {
      onload?: () => void
      set src(_: string) { queueMicrotask(() => this.onload?.()) }
    })
    await colormapService.initialize()
  })

  afterAll(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps all 256 entries of a colormap', () => {
    const table = colormapService.getColormapTable('viridis')!
    expect(table).toHaveLength(1024)
    expect([...table.slice(0, 4)]).toEqual([0, 255, 7, 255])
    expect([...table.slice(255 * 4, 256 * 4)]).toEqual([255, 0, 7, 255])
  })

  it('still gives the first color', () => {
    expect(colormapService.getColormapFirstColor('viridis').green).toBe(1)
  })

  it('has no table for a malformed response', () => {
    expect(colormapService.getColormapTable('short')).toBeUndefined()
    expect(colormapService.getColormapTable('badentry')).toBeUndefined()
    expect(colormapService.getColormapFirstColor('short').red).toBeCloseTo(1 / 255)
  })

  it('has no table after a failed fetch', () => {
    expect(colormapService.getColormapTable('failing')).toBeUndefined()
    expect(colormapService.getColormapFirstColor('failing').red).toBe(0)
  })

  it('has no table for a colormap never asked for', () => {
    expect(colormapService.getColormapTable('magma')).toBeUndefined()
  })
})
