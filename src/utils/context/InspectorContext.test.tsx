import { act, render, renderHook } from '@testing-library/react'
import * as Cesium from 'cesium'

const viewerState = vi.hoisted(() => ({ viewer: null as unknown }))
vi.mock('./ViewerContext', () => ({
  useViewer: () => ({ viewer: viewerState.viewer, setViewer: vi.fn() }),
}))

const stats = vi.hoisted(() => ({ retryMissing: vi.fn(), listeners: new Set<() => void>() }))
vi.mock('services/LayerStatsService', () => ({
  layerStatsService: {
    retryMissing: stats.retryMissing,
    subscribe: (listener: () => void) => {
      stats.listeners.add(listener)
      return () => stats.listeners.delete(listener)
    },
  },
}))

import { FeaturesProvider, useFeaturesContext } from './FeaturesContext'
import { InspectorProvider, useFeatureResults, useInspectorContext, useLayerStatsVersion } from './InspectorContext'
import { fakeStore, makeFeature, makeResults } from 'components/inspector/inspectorTestUtils'

function setup(store = fakeStore()) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <FeaturesProvider><InspectorProvider store={store}>{children}</InspectorProvider></FeaturesProvider>
  )
  const hook = renderHook(() => ({ features: useFeaturesContext(), inspector: useInspectorContext() }), { wrapper })
  return { store, ...hook }
}

beforeEach(() => {
  viewerState.viewer = null
  stats.retryMissing.mockClear()
})

describe('InspectorProvider', () => {
  it('syncs the store with the features', () => {
    const { store, result } = setup()
    const feature = makeFeature({ id: 'a', type: 'point' })
    act(() => result.current.features.addFeature(feature))
    expect(store.sync).toHaveBeenLastCalledWith([feature])
  })

  it('ticks features for the comparison, and drops a deleted one', () => {
    const { result } = setup()
    act(() => {
      result.current.features.addFeature(makeFeature({ id: 'a', type: 'point' }))
      result.current.features.addFeature(makeFeature({ id: 'b', type: 'point' }))
    })
    act(() => result.current.inspector.toggleCompared('a'))
    act(() => result.current.inspector.addCompared('b'))
    act(() => result.current.inspector.addCompared('b'))
    expect([...result.current.inspector.comparedIds]).toEqual(['a', 'b'])

    act(() => result.current.inspector.toggleCompared('a'))
    expect([...result.current.inspector.comparedIds]).toEqual(['b'])

    act(() => result.current.features.removeFeature('b'))
    expect(result.current.inspector.comparedIds.size).toBe(0)
  })

  it('opens and closes the comparison', () => {
    const { result } = setup()
    act(() => result.current.inspector.setComparisonOpen(true))
    expect(result.current.inspector.isComparisonOpen).toBe(true)
  })

  it('retries the missing whole Moon statistics of every Inspector file', () => {
    const { result } = setup()
    act(() => result.current.inspector.retryMissingStatistics())
    expect(stats.retryMissing).toHaveBeenCalledWith(expect.arrayContaining(['chemical_elements/thorium/thoriumhd_COG.tif']))
    expect(stats.retryMissing.mock.calls[0][0]).toHaveLength(50)
  })

  it('pauses area requests while the camera moves', () => {
    const moveStart = new Cesium.Event()
    const moveEnd = new Cesium.Event()
    viewerState.viewer = { camera: { moveStart, moveEnd } }
    const { store, unmount } = setup()

    moveStart.raiseEvent()
    expect(store.pauseAreas).toHaveBeenCalledTimes(1)
    moveEnd.raiseEvent()
    expect(store.resumeAreas).toHaveBeenCalledTimes(1)

    unmount()
    expect(moveStart.numberOfListeners).toBe(0)
    expect(store.dispose).toHaveBeenCalled()
  })

  it('throws outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useInspectorContext())).toThrow('within an InspectorProvider')
  })
})

describe('hooks', () => {
  it('re-renders on new results', () => {
    const store = fakeStore()
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <FeaturesProvider><InspectorProvider store={store}>{children}</InspectorProvider></FeaturesProvider>
    )
    const { result } = renderHook(() => useFeatureResults('a'), { wrapper })
    expect(result.current).toBeUndefined()
    act(() => store.set('a', makeResults('point')))
    expect(result.current?.kind).toBe('point')
  })

  it('counts stored whole Moon statistics', () => {
    const { result } = renderHook(() => useLayerStatsVersion())
    expect(result.current).toBe(0)
    act(() => stats.listeners.forEach(listener => listener()))
    expect(result.current).toBe(1)
  })

  it('renders children', () => {
    const { getByText } = render(
      <FeaturesProvider><InspectorProvider store={fakeStore()}><p>child</p></InspectorProvider></FeaturesProvider>
    )
    expect(getByText('child')).toBeInTheDocument()
  })
})
