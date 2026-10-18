import * as Cesium from 'cesium'
import { act, fireEvent, renderHook } from '@testing-library/react'

let nextToken = 0
const holdAt = vi.fn(() => ++nextToken)
const releaseHold = vi.fn()
vi.mock('services/PointValueService', () => ({
  pointValueService: { holdAt: (...args: unknown[]) => holdAt(...(args as [])), releaseHold: (token: number) => releaseHold(token) },
}))

import { FEATURE_MARKER_ATTRIBUTE, GLOBE_POPUP_ATTRIBUTE, GlobePopupProvider, useGlobePopup } from './GlobePopupContext'

const position = Cesium.Cartesian3.fromDegrees(-50.5, 22.25, 0, Cesium.Ellipsoid.MOON)
const renderPopup = () => renderHook(() => useGlobePopup(), { wrapper: GlobePopupProvider })

function element(attributes: Record<string, string>): HTMLElement {
  const el = document.createElement('div')
  Object.entries(attributes).forEach(([name, value]) => el.setAttribute(name, value))
  const child = document.createElement('span')
  el.appendChild(child)
  document.body.appendChild(el)
  return child
}

beforeEach(() => {
  holdAt.mockClear()
  releaseHold.mockClear()
  document.body.innerHTML = ''
})

describe('the globe menu', () => {
  it('opens at the click with its coordinate and holds the scanner there', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 12, y: 34 }, position))

    const popup = result.current.popup
    expect(popup).toMatchObject({ kind: 'menu', screen: { x: 12, y: 34 }, position, holdToken: 1 })
    expect(popup?.kind === 'menu' && popup.lon).toBeCloseTo(-50.5)
    expect(popup?.kind === 'menu' && popup.lat).toBeCloseTo(22.25)
    expect(holdAt).toHaveBeenCalledWith(position)
  })

  it('releases the hold of the menu it replaces', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 1, y: 1 }, position))
    const first = (result.current.popup as { holdToken: number }).holdToken
    act(() => result.current.openMenu({ x: 2, y: 2 }, position))
    expect(releaseHold).toHaveBeenCalledWith(first)
  })

  it('releases its hold when it closes', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 1, y: 1 }, position))
    act(() => result.current.closePopup())
    expect(result.current.popup).toBeNull()
    expect(releaseHold).toHaveBeenCalledTimes(1)
  })

  it('hands its hold over when asked', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 1, y: 1 }, position))
    let token: number | null = null
    act(() => { token = result.current.closeMenuKeepingHold() })
    expect(token).toBe(nextToken)
    expect(result.current.popup).toBeNull()
    expect(releaseHold).not.toHaveBeenCalled()

    act(() => { token = result.current.closeMenuKeepingHold() })
    expect(token).toBeNull()
  })

  it('closes when a feature box opens', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 1, y: 1 }, position))
    act(() => result.current.openFeatureBox('point-1'))
    expect(result.current.popup).toEqual({ kind: 'feature', featureId: 'point-1' })
    expect(releaseHold).toHaveBeenCalledTimes(1)

    act(() => result.current.closePopup())
    expect(releaseHold).toHaveBeenCalledTimes(1)
  })
})

describe('closing', () => {
  it('closes on a press outside, not inside', () => {
    const { result } = renderPopup()
    act(() => result.current.openMenu({ x: 1, y: 1 }, position))

    fireEvent.pointerDown(element({ [GLOBE_POPUP_ATTRIBUTE]: '' }))
    expect(result.current.popup).not.toBeNull()

    fireEvent.pointerDown(element({}))
    expect(result.current.popup).toBeNull()
  })

  it('leaves a press on the open box marker to the marker', () => {
    const { result } = renderPopup()
    act(() => result.current.openFeatureBox('point-1'))

    fireEvent.pointerDown(element({ [FEATURE_MARKER_ATTRIBUTE]: 'point-1' }))
    expect(result.current.popup).not.toBeNull()

    fireEvent.pointerDown(element({ [FEATURE_MARKER_ATTRIBUTE]: 'point-2' }))
    expect(result.current.popup).toBeNull()
  })

  it('closes on a press outside any element', () => {
    const { result } = renderPopup()
    act(() => result.current.openFeatureBox('point-1'))
    fireEvent.pointerDown(document)
    expect(result.current.popup).toBeNull()
  })

  it('closes on Escape only', () => {
    const { result } = renderPopup()
    act(() => result.current.openFeatureBox('point-1'))
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(result.current.popup).not.toBeNull()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(result.current.popup).toBeNull()
  })
})

it('requires its provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(() => useGlobePopup())).toThrow('useGlobePopup must be used within a GlobePopupProvider')
})
