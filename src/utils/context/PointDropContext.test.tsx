import * as Cesium from 'cesium'
import { act, renderHook } from '@testing-library/react'

const viewerState: { viewer: unknown } = { viewer: null }
vi.mock('./ViewerContext', () => ({ useViewer: () => viewerState }))

const addFeature = vi.fn()
vi.mock('./FeaturesContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./FeaturesContext')>()),
  useFeaturesContext: () => ({ addFeature }),
}))

const settings = { reduceMotion: false }
vi.mock('./AppSettingsContext', () => ({ useAppSettings: () => settings }))

const openDialogs = new Set<string>()
vi.mock('utils/DialogWindowManagement', () => ({
  useDialogContext: () => ({ isDialogOpen: (id: string) => openDialogs.has(id) }),
}))

const releaseHold = vi.fn()
vi.mock('services/PointValueService', () => ({ pointValueService: { releaseHold: (token: number) => releaseHold(token) } }))

import { PointDropProvider, usePointDrop } from './PointDropContext'

const position = Cesium.Cartesian3.fromDegrees(10, 20, 0, Cesium.Ellipsoid.MOON)

function fakeViewer() {
  return {
    entities: { add: vi.fn((options: Cesium.Entity.ConstructorOptions) => new Cesium.Entity(options)) },
    scene: { globe: { ellipsoid: Cesium.Ellipsoid.MOON } },
  }
}

const renderDrops = () => renderHook(() => usePointDrop(), { wrapper: PointDropProvider })

function drop(result: { current: ReturnType<typeof usePointDrop> }, holdToken: number | null = 7) {
  act(() => result.current.dropPoint(position, holdToken))
  return result.current.drops.at(-1)!.featureId
}

const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  viewerState.viewer = fakeViewer()
  settings.reduceMotion = false
  openDialogs.clear()
  addFeature.mockClear()
  releaseHold.mockClear()
})
afterEach(() => { vi.useRealTimers() })

describe('a drop', () => {
  it('creates a point named as the point tool names its points, without a source id', () => {
    const { result } = renderDrops()
    const id = drop(result)
    advance(40)
    const feature = addFeature.mock.calls[0][0]
    expect(feature.id).toBe(id)
    expect(feature.name).toMatch(/^Point \d+$/)
    expect(feature.metadata.sourceId).toBeUndefined()
    expect(feature.metadata.position.longitude).toBeCloseTo(Cesium.Math.toRadians(10))
  })

  it('runs the probe, the impact, the marker and the fly to the Features button', () => {
    const { result } = renderDrops()
    const id = drop(result)

    expect(result.current.drops).toMatchObject([{ featureId: id, stage: 'probe', flyTarget: null, reduceMotion: false }])
    expect(result.current.markerArrivals).toEqual({ [id]: 'hidden' })
    expect(result.current.rowArrivals).toEqual({ [id]: 'pending' })

    advance(380)
    expect(result.current.drops[0].stage).toBe('impact')
    expect(releaseHold).not.toHaveBeenCalled()

    advance(160)
    expect(result.current.markerArrivals).toEqual({ [id]: 'pop' })
    expect(releaseHold).toHaveBeenCalledWith(7)

    advance(380)
    expect(result.current.markerArrivals).toEqual({})
    expect(result.current.drops[0]).toMatchObject({ stage: 'fly', flyTarget: 'rail' })

    advance(700)
    expect(result.current.drops).toEqual([])
    expect(result.current.rowArrivals).toEqual({})
    expect(result.current.railNotice).toMatchObject({ kind: 'receive' })

    advance(900)
    expect(result.current.railNotice).toBeNull()
  })

  it('lands on the new row while the Features window is open', () => {
    const { result } = renderDrops()
    const id = drop(result)
    openDialogs.add('features-dialog')

    advance(920)
    expect(result.current.drops[0].flyTarget).toBe('row')

    // The window closing mid-flight does not move the landing.
    openDialogs.clear()
    advance(700)
    expect(result.current.rowArrivals).toEqual({ [id]: 'highlight' })
    expect(result.current.railNotice).toBeNull()

    advance(1400)
    expect(result.current.rowArrivals).toEqual({})
  })

  it('leaves the scanner alone without a hold', () => {
    const { result } = renderDrops()
    drop(result, null)
    advance(2000)
    expect(releaseHold).not.toHaveBeenCalled()
  })

  it('keeps a newer notice when an older one expires', () => {
    const { result } = renderDrops()
    drop(result)
    advance(500)
    drop(result)

    advance(1120)
    const first = result.current.railNotice
    advance(500)
    const second = result.current.railNotice
    expect(second?.key).not.toBe(first?.key)

    // The first notice's expiry passes while the second is showing.
    advance(400)
    expect(result.current.railNotice).toBe(second)
    advance(500)
    expect(result.current.railNotice).toBeNull()
  })

  it('does nothing without a viewer', () => {
    viewerState.viewer = null
    const { result } = renderDrops()
    act(() => result.current.dropPoint(position, 7))
    expect(addFeature).not.toHaveBeenCalled()
    expect(result.current.drops).toEqual([])
  })

  it('adds the point once the probe is on screen', () => {
    const { result } = renderDrops()
    drop(result)
    expect(addFeature).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersToNextFrame() })
    expect(addFeature).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersToNextFrame() })
    expect(addFeature).toHaveBeenCalledTimes(1)
  })

  it('stops its timeline when unmounted', () => {
    const { result, unmount } = renderDrops()
    drop(result)
    unmount()
    vi.advanceTimersByTime(2000)
    expect(releaseHold).not.toHaveBeenCalled()
    expect(addFeature).not.toHaveBeenCalled()
  })
})

describe('a drop with reduced motion', () => {
  beforeEach(() => { settings.reduceMotion = true })

  it('starts every stage at once and lights up the Features button', () => {
    const { result } = renderDrops()
    const id = drop(result)
    expect(addFeature).toHaveBeenCalledTimes(1)

    expect(result.current.drops).toMatchObject([{ stage: 'impact', reduceMotion: true }])
    expect(result.current.markerArrivals).toEqual({ [id]: 'fade' })
    expect(result.current.rowArrivals).toEqual({})
    expect(result.current.railNotice).toMatchObject({ kind: 'notice' })
    expect(releaseHold).toHaveBeenCalledWith(7)

    advance(300)
    expect(result.current.markerArrivals).toEqual({})

    advance(600)
    expect(result.current.drops).toEqual([])
    expect(result.current.railNotice).toBeNull()
  })

  it('lights up the new row while the Features window is open', () => {
    openDialogs.add('features-dialog')
    const { result } = renderDrops()
    const id = drop(result)

    expect(result.current.rowArrivals).toEqual({ [id]: 'notice' })
    expect(result.current.railNotice).toBeNull()

    advance(900)
    expect(result.current.rowArrivals).toEqual({})
  })
})

it('requires its provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(() => usePointDrop())).toThrow('usePointDrop must be used within a PointDropProvider')
})
