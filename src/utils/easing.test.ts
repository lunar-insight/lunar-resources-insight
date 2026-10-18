import { cubicBezier, easeInOut, easeOut, keyframeValue } from './easing'

describe('cubicBezier', () => {
  it('is linear for the linear curve', () => {
    const linear = cubicBezier(0, 0, 1, 1)
    expect(linear(0.25)).toBeCloseTo(0.25, 5)
    expect(linear(0.8)).toBeCloseTo(0.8, 5)
  })

  it('clamps outside [0, 1]', () => {
    expect(easeOut(-1)).toBe(0)
    expect(easeOut(2)).toBe(1)
  })

  it('matches known values of the CSS curves', () => {
    // ease-out is fast first, ease-in-out symmetric around the middle.
    expect(easeOut(0.5)).toBeCloseTo(0.6846, 3)
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 5)
    expect(easeInOut(0.25)).toBeCloseTo(1 - easeInOut(0.75), 5)
  })
})

describe('keyframeValue', () => {
  const frames = [[0, 0], [0.2, 1], [1, 0]] as const

  it('holds the first value before the first offset', () => {
    expect(keyframeValue(-0.5, frames)).toBe(0)
    expect(keyframeValue(0, [[0.1, 3], [1, 4]])).toBe(3)
  })

  it('interpolates between keyframes', () => {
    expect(keyframeValue(0.1, frames)).toBeCloseTo(0.5)
    expect(keyframeValue(0.6, frames)).toBeCloseTo(0.5)
  })

  it('holds the last value after the last offset', () => {
    expect(keyframeValue(1.5, frames)).toBe(0)
    expect(keyframeValue(1, [[0, 1], [0.5, 2]])).toBe(2)
  })
})
