// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { drawPicture } from './drawPicture'

/** Records every call and every property set, in order. */
function recordingContext() {
  const log: unknown[][] = []
  const context = new Proxy({}, {
    get: (_target, name: string) => (...args: unknown[]) => { log.push([name, ...args]) },
    set: (_target, name: string, value) => { log.push([`set ${name}`, value]); return true },
  }) as unknown as CanvasRenderingContext2D
  return { context, log, names: () => log.map(entry => entry[0]) }
}

const base = { id: 'base' } as unknown as CanvasImageSource
const square = [{ px: 10, py: 10 }, { px: 20, py: 10 }, { px: 20, py: 20 }]

describe('drawPicture', () => {
  it('draws in frame positions, at 2× and with no smoothing', () => {
    const { context, log } = recordingContext()
    drawPicture(context, base, { color: '#fff' })
    expect(log).toEqual([
      ['setTransform', 2, 0, 0, 2, 0, 0],
      ['clearRect', 0, 0, 211, 150],
      ['set imageSmoothingEnabled', false],
      ['drawImage', base, 0, 0, 211, 150],
    ])
  })

  it('draws the tints over the base, in order', () => {
    const { context, log } = recordingContext()
    const tints = [{ id: 'a' }, { id: 'b' }] as unknown as CanvasImageSource[]
    drawPicture(context, base, { color: '#fff', tints })
    expect(log.filter(entry => entry[0] === 'drawImage').map(entry => entry[1])).toEqual([base, ...tints])
  })

  it('dims outside the outline, then strokes it in the feature color', () => {
    const { context, log, names } = recordingContext()
    drawPicture(context, base, { color: '#f2c14e', outline: square })

    expect(log).toContainEqual(['rect', 0, 0, 211, 150])
    expect(log).toContainEqual(['set fillStyle', 'rgba(0, 0, 0, 0.55)'])
    expect(log).toContainEqual(['fill', 'evenodd'])
    expect(log).toContainEqual(['set strokeStyle', '#f2c14e'])
    expect(log).toContainEqual(['moveTo', 10, 10])
    expect(log).toContainEqual(['lineTo', 20, 20])
    expect(names().indexOf('fill')).toBeLessThan(names().indexOf('stroke'))
    expect(names()).not.toContain('arc')
  })

  it('marks a point with a ring and four arms, over a darker halo', () => {
    const { context, log, names } = recordingContext()
    drawPicture(context, base, { color: '#f2c14e', mark: { px: 100, py: 50 } })

    expect(log).toContainEqual(['arc', 100, 50, 7, 0, 2 * Math.PI])
    expect(log).toContainEqual(['moveTo', 91, 50])
    expect(log).toContainEqual(['lineTo', 87, 50])
    expect(log).toContainEqual(['lineTo', 100, 63])
    expect(names().filter(name => name === 'stroke')).toHaveLength(2)
    const strokes = log.filter(entry => entry[0] === 'set strokeStyle').map(entry => entry[1])
    expect(strokes).toEqual(['rgba(0, 0, 0, 0.6)', '#f2c14e'])
    expect(names()).not.toContain('fill')
  })
})
