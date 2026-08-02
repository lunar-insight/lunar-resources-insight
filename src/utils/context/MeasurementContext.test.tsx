import { act, renderHook } from '@testing-library/react'
import * as Cesium from 'cesium'
import { MeasurementProvider, useMeasurementContext } from './MeasurementContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MeasurementProvider>{children}</MeasurementProvider>
)

const point = Cesium.Cartographic.fromDegrees(10, 20, 0)

describe('initial state', () => {
  it('starts inactive with no points and no distance', () => {
    const { result } = renderHook(() => useMeasurementContext(), { wrapper })
    expect(result.current.isActive).toBe(false)
    expect(result.current.points).toEqual([])
    expect(result.current.distanceMeters).toBeNull()
    expect(result.current.isDistanceLoading).toBe(false)
    expect(result.current.distanceMode).toBe('surface')
  })
})

describe('toggleMeasurement', () => {
  it('activates the tool', () => {
    const { result } = renderHook(() => useMeasurementContext(), { wrapper })
    act(() => result.current.toggleMeasurement())
    expect(result.current.isActive).toBe(true)
  })

  it('clears points and distance when deactivated', () => {
    const { result } = renderHook(() => useMeasurementContext(), { wrapper })
    act(() => result.current.toggleMeasurement())
    act(() => {
      result.current.setPoints([point])
      result.current.setDistanceMeters(123)
      result.current.setIsDistanceLoading(true)
    })

    act(() => result.current.toggleMeasurement())

    expect(result.current.isActive).toBe(false)
    expect(result.current.points).toEqual([])
    expect(result.current.distanceMeters).toBeNull()
    expect(result.current.isDistanceLoading).toBe(false)
  })
})

describe('setPoints and setDistanceMeters', () => {
  it('stores committed points and distance', () => {
    const { result } = renderHook(() => useMeasurementContext(), { wrapper })
    act(() => {
      result.current.setPoints([point, point])
      result.current.setDistanceMeters(42)
    })
    expect(result.current.points).toEqual([point, point])
    expect(result.current.distanceMeters).toBe(42)
  })
})

describe('setDistanceMode', () => {
  it('switches between surface and terrain', () => {
    const { result } = renderHook(() => useMeasurementContext(), { wrapper })
    act(() => result.current.setDistanceMode('terrain'))
    expect(result.current.distanceMode).toBe('terrain')
  })
})

describe('useMeasurementContext outside provider', () => {
  it('throws when used outside MeasurementProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useMeasurementContext())).toThrow(
      'useMeasurementContext must be used within a MeasurementProvider'
    )
    vi.restoreAllMocks()
  })
})
