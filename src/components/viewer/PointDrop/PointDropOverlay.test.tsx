import * as Cesium from 'cesium'
import { act, render } from '@testing-library/react'
import type { PointDrop } from 'utils/context/PointDropContext'

const viewerState: { viewer: unknown } = { viewer: null }
vi.mock('utils/context/ViewerContext', () => ({ useViewer: () => viewerState }))

const dropState: { drops: PointDrop[] } = { drops: [] }
vi.mock('utils/context/PointDropContext', () => ({ usePointDrop: () => dropState }))

const { impactDestroy, ProbeImpactMock } = vi.hoisted(() => {
  const impactDestroy = vi.fn()
  const ProbeImpactMock = Object.assign(
    vi.fn(function (this: { destroy: () => void }) { this.destroy = impactDestroy }),
    { keepShadersCompiled: vi.fn() }
  )
  return { impactDestroy, ProbeImpactMock }
})
vi.mock('./ProbeImpact', () => ({ ProbeImpact: ProbeImpactMock }))

import PointDropOverlay, { flyCurve, pathKeyframes, probeStartOffset } from './PointDropOverlay'
import styles from './PointDropOverlay.module.scss'

const position = Cesium.Cartesian3.fromDegrees(10, 20, 0, Cesium.Ellipsoid.MOON)
const SPOT = new Cesium.Cartesian2(200, 150)

function fakeViewer(projects = true) {
  return {
    scene: {
      cartesianToCanvasCoordinates: vi.fn(() => (projects ? SPOT : undefined)),
      postRender: { addEventListener: vi.fn(), removeEventListener: vi.fn() },
    },
    canvas: { getBoundingClientRect: () => ({ left: 80, top: 0 }) },
    terrainProvider: undefined as unknown,
  }
}

const makeDrop = (overrides: Partial<PointDrop> = {}): PointDrop => ({
  id: 1, featureId: 'point-1', position, reduceMotion: false, stage: 'probe', flyTarget: null, ...overrides,
})

function target(attributes: Record<string, string>, rect: { left: number; top: number; width: number; height: number }) {
  const wrapper = document.createElement('div')
  Object.entries(attributes).forEach(([name, value]) => wrapper.setAttribute(name, value))
  const icon = document.createElement('i')
  icon.setAttribute('data-fly-target', '')
  icon.getBoundingClientRect = () => rect as DOMRect
  icon.scrollIntoView = vi.fn()
  wrapper.appendChild(icon)
  document.body.appendChild(wrapper)
  return icon
}

const railTarget = () => target({ 'data-rail-id': 'features-dialog' }, { left: 20, top: 500, width: 24, height: 24 })
const cancel = vi.fn()
const animate = vi.fn((): unknown => ({ cancel }))

// The animation started on each element with a class, in render order.
const animations = (className: string) =>
  animate.mock.contexts
    .map((element, index) => ({ element: element as HTMLElement, call: animate.mock.calls[index] as unknown as [Keyframe[], KeyframeAnimationOptions] }))
    .filter(({ element }) => element.classList.contains(className))
    .map(({ call: [keyframes, options] }) => ({ keyframes, options }))

beforeEach(() => {
  viewerState.viewer = fakeViewer()
  dropState.drops = []
  ProbeImpactMock.mockClear()
  ProbeImpactMock.keepShadersCompiled.mockClear()
  impactDestroy.mockClear()
  animate.mockClear()
  cancel.mockClear()
  HTMLElement.prototype.animate = animate as unknown as HTMLElement['animate']
  document.body.innerHTML = ''
})
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate
})

describe('the probe', () => {
  it('falls from above the view, slanted from the upper left, with a trail', () => {
    dropState.drops = [makeDrop()]
    render(<PointDropOverlay />)

    const dots = animations(styles.probeDot)
    expect(dots).toHaveLength(4)
    // The spot is 150 px down, so the probe falls 180 px from 63 px to its left.
    expect(dots[0].keyframes[0]).toEqual({ transform: 'translate(-63px, -180px) scale(1)', opacity: 1, offset: 0 })
    expect(dots[0].keyframes.at(-1)).toEqual({ transform: 'translate(0px, 0px) scale(1)', opacity: 0, offset: 1 })
    expect(dots[0].options).toEqual({ fill: 'both', duration: 380, delay: 0, easing: 'cubic-bezier(0.55, 0, 0.85, 0.5)' })
    expect(dots[3].options.delay).toBe(42)
    expect(dots[3].keyframes[0].opacity).toBeCloseTo(0.28)
    expect(animations(styles.flash)).toHaveLength(0)
    expect(ProbeImpactMock).not.toHaveBeenCalled()
  })

  it('stops its animations when it leaves', () => {
    dropState.drops = [makeDrop()]
    const { rerender } = render(<PointDropOverlay />)
    dropState.drops = []
    rerender(<PointDropOverlay />)
    expect(cancel).toHaveBeenCalledTimes(4)
  })

  it('still renders where the browser cannot animate', () => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate
    dropState.drops = [makeDrop()]
    const { unmount } = render(<PointDropOverlay />)
    expect(document.querySelectorAll(`.${styles.probeDot}`)).toHaveLength(4)
    unmount()
  })
})

describe('the impact', () => {
  it('flashes and starts the ground effects, once', () => {
    dropState.drops = [makeDrop({ stage: 'impact' })]
    const { rerender, unmount } = render(<PointDropOverlay />)
    expect(animations(styles.flash)).toEqual([{
      keyframes: [{ transform: 'scale(0.2)', opacity: 1 }, { transform: 'scale(1.35)', opacity: 0 }],
      options: { fill: 'both', duration: 320, easing: 'ease-out' },
    }])
    expect(ProbeImpactMock).toHaveBeenCalledWith(viewerState.viewer, position, false)

    dropState.drops = [makeDrop({ stage: 'fly', flyTarget: 'rail' })]
    rerender(<PointDropOverlay />)
    expect(document.querySelectorAll(`.${styles.flash}`)).toHaveLength(0)
    expect(document.querySelectorAll(`.${styles.probeDot}`)).toHaveLength(0)
    expect(ProbeImpactMock).toHaveBeenCalledTimes(1)

    unmount()
    expect(impactDestroy).toHaveBeenCalled()
  })

  it('shows only the ground effects with reduced motion', () => {
    dropState.drops = [makeDrop({ stage: 'impact', reduceMotion: true })]
    render(<PointDropOverlay />)
    expect(animate).not.toHaveBeenCalled()
    expect(ProbeImpactMock).toHaveBeenCalledWith(viewerState.viewer, position, true)
  })
})

describe('the fly to Features', () => {
  it('flies a dot with its trail above the interface', () => {
    railTarget()
    dropState.drops = [makeDrop({ stage: 'fly', flyTarget: 'rail' })]
    render(<PointDropOverlay />)

    const layer = document.body.querySelector(`.${styles.flyLayer}`)
    expect(layer?.parentElement).toBe(document.body)
    const dots = animations(styles.flyDot)
    expect(dots).toHaveLength(6)
    expect(dots[0].keyframes).toHaveLength(20)
    expect(dots[0].keyframes[0].transform).toBe('translate(280px, 150px) scale(1)')
    expect(dots[0].keyframes.at(-1)).toMatchObject({ transform: 'translate(32px, 512px) scale(1)', opacity: 0 })
    expect(dots[0].options).toMatchObject({ duration: 700, easing: 'cubic-bezier(0.45, 0, 0.3, 1)' })
  })

  it('flies nothing without a target', () => {
    dropState.drops = [makeDrop({ stage: 'fly', flyTarget: 'rail' })]
    render(<PointDropOverlay />)
    expect(document.querySelectorAll(`.${styles.flyDot}`)).toHaveLength(0)
  })

  it('flies nothing with reduced motion', () => {
    railTarget()
    dropState.drops = [makeDrop({ stage: 'fly', reduceMotion: true })]
    render(<PointDropOverlay />)
    expect(document.querySelectorAll(`.${styles.flyDot}`)).toHaveLength(0)
  })
})

describe('the overlay', () => {
  it('renders nothing without a viewer', () => {
    viewerState.viewer = null
    dropState.drops = [makeDrop()]
    const { container } = render(<PointDropOverlay />)
    expect(container).toBeEmptyDOMElement()
    expect(ProbeImpactMock.keepShadersCompiled).not.toHaveBeenCalled()
  })

  it('compiles the impact shaders once the browser is idle', () => {
    let idle: () => void = () => {}
    window.requestIdleCallback = vi.fn((callback: () => void) => { idle = callback; return 7 }) as never
    window.cancelIdleCallback = vi.fn()
    const { unmount } = render(<PointDropOverlay />)
    expect(ProbeImpactMock.keepShadersCompiled).not.toHaveBeenCalled()

    idle()
    expect(ProbeImpactMock.keepShadersCompiled).toHaveBeenCalledWith(viewerState.viewer)
    unmount()
    expect(window.cancelIdleCallback).toHaveBeenCalledWith(7)
    delete (window as Partial<Window>).requestIdleCallback
    delete (window as Partial<Window>).cancelIdleCallback
  })

  it('compiles them on the next task where the browser has no idle callback', () => {
    vi.useFakeTimers()
    const { unmount } = render(<PointDropOverlay />)
    act(() => { vi.runAllTimers() })
    expect(ProbeImpactMock.keepShadersCompiled).toHaveBeenCalledTimes(1)
    unmount()

    render(<PointDropOverlay />).unmount()
    act(() => { vi.runAllTimers() })
    expect(ProbeImpactMock.keepShadersCompiled).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})

describe('probeStartOffset', () => {
  it('falls 30 px when the spot does not project', () => {
    const start = probeStartOffset(fakeViewer(false) as unknown as Cesium.Viewer, position)
    expect(start.x).toBeCloseTo(-10.5)
    expect(start.y).toBe(-30)
  })
})

describe('pathKeyframes', () => {
  it('spreads the points over the animation and hides the dot at the end', () => {
    const keyframes = pathKeyframes([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }], { delay: 0, scale: 0.5, opacity: 0.8 })
    expect(keyframes.map(frame => frame.offset)).toEqual([0, 0.4995, 0.999, 1])
    expect(keyframes[1]).toEqual({ transform: 'translate(10px, 0px) scale(0.5)', opacity: 0.8, offset: 0.4995 })
    expect(keyframes[3]).toEqual({ transform: 'translate(20px, 5px) scale(0.5)', opacity: 0, offset: 1 })
  })
})

describe('flyCurve', () => {
  const viewer = () => viewerState.viewer as Cesium.Viewer

  it('curves from the spot to the new row, scrolled into view', () => {
    const row = target({ 'data-feature-row': 'point-1' }, { left: 400, top: 300, width: 20, height: 20 })
    railTarget()

    // From the spot at (280, 150) on the page to the row icon's center at (410, 310),
    // through a control point 110 px above the higher end.
    const curve = flyCurve(viewer(), makeDrop({ flyTarget: 'row' }))!
    expect(curve).toHaveLength(19)
    expect(curve[0]).toEqual({ x: 280, y: 150 })
    expect(curve[18]).toEqual({ x: 410, y: 310 })
    expect(curve[9].x).toBeCloseTo((280 + 2 * 345 + 410) / 4)
    expect(curve[9].y).toBeCloseTo((150 + 2 * 40 + 310) / 4)
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('falls back to the Features button when the row is gone', () => {
    railTarget()
    expect(flyCurve(viewer(), makeDrop({ flyTarget: 'row' }))!.at(-1)).toEqual({ x: 32, y: 512 })
  })

  it('gives nothing while the spot is out of view', () => {
    railTarget()
    expect(flyCurve(fakeViewer(false) as unknown as Cesium.Viewer, makeDrop({ flyTarget: 'rail' }))).toBeNull()
  })
})
