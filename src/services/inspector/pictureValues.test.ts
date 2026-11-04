// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fixture from './__fixtures__/shi_feo_32px.json'
import {
  GRAY_TABLE,
  binMask,
  canHighlight,
  colorize,
  decodeRgba,
  limitMask,
  limitShare,
  readoutDecimals,
  valueOf,
  type ValueRange,
} from './pictureValues'
import { PICTURE_HEIGHT, PICTURE_WIDTH, type View } from './pictureGeometry'

const gray = Uint8Array.from(fixture.gray)
const alpha = Uint8Array.from(fixture.alpha)
const range = fixture.range as ValueRange
const viridis = Uint8Array.from(fixture.tables.viridis)
const magma = Uint8Array.from(fixture.tables.magma)

describe('decodeRgba', () => {
  it('reads gray from red and alpha from alpha', () => {
    const { gray: g, alpha: a } = decodeRgba(Uint8ClampedArray.from([10, 10, 10, 255, 20, 20, 20, 0]), 2, 1)
    expect([...g]).toEqual([10, 20])
    expect([...a]).toEqual([255, 0])
  })
})

describe('valueOf', () => {
  it('reads a level as its middle', () => {
    expect(valueOf(0, [0, 255])).toBe(0.5)
    expect(valueOf(100, [0, 24])).toBeCloseTo((100.5 / 255) * 24, 10)
  })

  it('reads 255 as the high end exactly', () => {
    expect(valueOf(255, [0, 24])).toBe(24)
  })

  it('takes the low end into account', () => {
    expect(valueOf(0, [10, 20])).toBeCloseTo(10 + (0.5 / 255) * 10, 10)
  })
})

describe('readoutDecimals', () => {
  it('shows no more decimals than one level holds', () => {
    expect(readoutDecimals([0, 24], 2)).toBe(1)
    expect(readoutDecimals([0, 2.55], 3)).toBe(2)
    expect(readoutDecimals([0, 1000], 2)).toBe(0)
  })

  it('keeps fewer decimals when the line has fewer', () => {
    expect(readoutDecimals([0, 1], 1)).toBe(1)
  })

  it('takes the line decimals on a range of one value', () => {
    expect(readoutDecimals([5, 5], 2)).toBe(2)
  })
})

describe('colorize', () => {
  it('matches the tiler on viridis at the whole range', () => {
    expect([...colorize(gray, alpha, range, viridis)]).toEqual(fixture.viridis)
  })

  it('stays within 5 of the tiler on magma at a narrower range', () => {
    const rgba = colorize(gray, alpha, range, magma, { rescale: [5, 15], filter: null })
    const differences = [...rgba].map((channel, i) => Math.abs(channel - fixture.magma5to15[i]))
    expect(Math.max(...differences)).toBeLessThanOrEqual(5)
  })

  it('goes through the gray table unchanged', () => {
    const rgba = colorize(Uint8Array.from([0, 128, 255]), Uint8Array.from([255, 255, 255]), [0, 255], GRAY_TABLE)
    expect([...rgba]).toEqual([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255])
  })

  it('keeps a transparent pixel transparent', () => {
    const rgba = colorize(Uint8Array.from([100]), Uint8Array.from([0]), range, viridis)
    expect([...rgba]).toEqual([0, 0, 0, 0])
  })

  it('clamps below and above the range to the ends of the table', () => {
    const rgba = colorize(Uint8Array.from([0, 255]), Uint8Array.from([255, 255]), [0, 100], viridis, { rescale: [20, 80], filter: null })
    expect([...rgba.slice(0, 3)]).toEqual([...viridis.slice(0, 3)])
    expect([...rgba.slice(4, 7)]).toEqual([...viridis.slice(255 * 4, 255 * 4 + 3)])
  })

  it('makes values outside the filter transparent, ends included in the kept range', () => {
    const rgba = colorize(Uint8Array.from([0, 100, 255]), Uint8Array.from([255, 255, 255]), [0, 100], viridis, {
      rescale: [0, 100],
      filter: [20, 100],
    })
    expect(rgba[3]).toBe(0)
    expect(rgba[7]).toBe(255)
    expect(rgba[11]).toBe(255)
  })

  it('takes the first color on a range of one value', () => {
    const rgba = colorize(Uint8Array.from([100]), Uint8Array.from([255]), [0, 100], viridis, { rescale: [5, 5], filter: null })
    expect([...rgba.slice(0, 3)]).toEqual([...viridis.slice(0, 3)])
  })
})

describe('binMask', () => {
  const inside = Uint8Array.from([1, 1, 1, 0, 1])
  const levels = Uint8Array.from([0, 127, 255, 127, 127])
  const opaque = Uint8Array.from([255, 255, 255, 255, 0])

  it('takes the opaque pixels inside the shape with a value in the bin', () => {
    expect([...binMask(levels, opaque, inside, [0, 255], [100, 200])]).toEqual([0, 1, 0, 0, 0])
  })

  it('holds the high end in the last bin', () => {
    expect([...binMask(levels, opaque, inside, [0, 255], [200, 255])]).toEqual([0, 0, 1, 0, 0])
  })
})

describe('limitMask', () => {
  const view: View = {
    center: { lon: 0, lat: 0 },
    x0: -1_000_000,
    y0: -710_900,
    x1: 1_000_000,
    y1: 710_900,
    parts: [],
  }
  const levels = new Uint8Array(PICTURE_WIDTH * PICTURE_HEIGHT).fill(255)
  const opaque = new Uint8Array(PICTURE_WIDTH * PICTURE_HEIGHT).fill(255)
  const sum = (mask: Uint8Array) => mask.reduce((total, value) => total + value, 0)

  it('takes level 255 at the high end', () => {
    const mask = limitMask(Uint8Array.from([255, 254]), Uint8Array.from([255, 255]), [0, 24], 24, undefined, view)
    expect([...mask]).toEqual([1, 0])
  })

  it('takes level 0 at the low end', () => {
    const mask = limitMask(Uint8Array.from([0, 1]), Uint8Array.from([255, 255]), [0, 24], 0, undefined, view)
    expect([...mask]).toEqual([1, 0])
  })

  it('takes the level holding a limit inside the range', () => {
    const mask = limitMask(Uint8Array.from([127, 128]), Uint8Array.from([255, 255]), [0, 255], 127.2, undefined, view)
    expect([...mask]).toEqual([1, 0])
  })

  it('leaves transparent pixels out', () => {
    expect([...limitMask(Uint8Array.from([255]), Uint8Array.from([0]), [0, 24], 24, undefined, view)]).toEqual([0])
  })

  it('takes level 0 on a range of one value', () => {
    expect([...limitMask(Uint8Array.from([0]), Uint8Array.from([255]), [5, 5], 5, undefined, view)]).toEqual([1])
  })

  it('keeps the pixels inside the clip longitudes', () => {
    const mask = limitMask(levels, opaque, [0, 24], 24, [-180, 0], view)
    // The projection is centered on 0°, so the west half of each row is kept
    expect(sum(mask)).toBe((PICTURE_WIDTH / 2) * PICTURE_HEIGHT)
    expect(mask[0]).toBe(1)
    expect(mask[PICTURE_WIDTH - 1]).toBe(0)
    expect(mask[PICTURE_WIDTH * (PICTURE_HEIGHT - 1)]).toBe(1)
  })

  it('leaves out pixels west of the clip longitudes', () => {
    const mask = limitMask(levels, opaque, [0, 24], 24, [0, 180], view)
    expect(mask[0]).toBe(0)
    expect(mask[PICTURE_WIDTH - 1]).toBe(1)
  })
})

describe('canHighlight', () => {
  it('holds from 2 levels', () => {
    const level = 24 / 255
    expect(canHighlight([0, 24], 2 * level)).toBe(true)
    expect(canHighlight([0, 24], 1.99 * level)).toBe(false)
  })
})

describe('limitShare', () => {
  it('counts over the opaque pixels', () => {
    expect(limitShare(Uint8Array.from([1, 0, 0, 1]), Uint8Array.from([255, 255, 255, 0]))).toBeCloseTo(1 / 3, 10)
  })

  it('is 0 with no opaque pixel', () => {
    expect(limitShare(Uint8Array.from([0]), Uint8Array.from([0]))).toBe(0)
  })
})
