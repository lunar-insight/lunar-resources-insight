vi.mock('hooks/useMouseTrackingControl', () => ({
  useMouseTrackingControl: vi.fn(),
}))

vi.mock('hooks/useInitialPosition', () => ({
  useInitialPosition: (): null => null,
}))

vi.mock('utils/ZIndexProvider', () => ({
  useZIndex: () => ({
    bringToFront: vi.fn(),
    getZIndex: () => 1000,
    registerModal: vi.fn(),
    unregisterModal: vi.fn(),
  }),
}))

import { act, fireEvent, render } from '@testing-library/react'
import { useMouseTrackingControl } from 'hooks/useMouseTrackingControl'
import { DraggableBoxContentContainer } from './DraggableBoxContentContainer'

const boundaryRef = { current: document.createElement('div') } as React.RefObject<HTMLDivElement>

function renderBox() {
  const { container } = render(
    <DraggableBoxContentContainer isOpen={true} onClose={vi.fn()} boundaryRef={boundaryRef}>
      <p>content</p>
    </DraggableBoxContentContainer>
  )
  return container.firstChild as HTMLElement
}

function lastShouldDisable() {
  const calls = vi.mocked(useMouseTrackingControl).mock.calls
  return calls[calls.length - 1][0]
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    unobserve = vi.fn()
    disconnect = vi.fn()
  })
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(useMouseTrackingControl).mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

// ─── Hover-driven scan pause, with the border-jitter grace window ─────────────

describe('hover-driven scan pause', () => {
  it('does not disable tracking before the mouse enters the box', () => {
    renderBox()
    expect(lastShouldDisable()).toBe(false)
  })

  it('disables tracking as soon as the mouse enters the box', () => {
    const box = renderBox()
    act(() => { fireEvent.mouseEnter(box) })
    expect(lastShouldDisable()).toBe(true)
  })

  it('keeps tracking disabled through a brief leave/re-enter pair at the border', () => {
    const box = renderBox()
    act(() => { fireEvent.mouseEnter(box) })
    act(() => { fireEvent.mouseLeave(box) })
    act(() => { vi.advanceTimersByTime(60) }) // still inside the grace window
    act(() => { fireEvent.mouseEnter(box) })
    act(() => { vi.advanceTimersByTime(200) }) // well past it now
    expect(lastShouldDisable()).toBe(true)
  })

  it('re-enables tracking once the mouse has actually left for longer than the grace window', () => {
    const box = renderBox()
    act(() => { fireEvent.mouseEnter(box) })
    act(() => { fireEvent.mouseLeave(box) })
    act(() => { vi.advanceTimersByTime(150) })
    expect(lastShouldDisable()).toBe(false)
  })

  it('does not disable tracking again if the mouse leaves before the grace window elapses', () => {
    const box = renderBox()
    act(() => { fireEvent.mouseEnter(box) })
    act(() => { fireEvent.mouseLeave(box) })
    act(() => { vi.advanceTimersByTime(60) })
    act(() => { fireEvent.mouseEnter(box) })
    act(() => { fireEvent.mouseLeave(box) })
    act(() => { vi.advanceTimersByTime(60) })
    // The second mouseleave started a fresh grace window; only 60ms of it has elapsed.
    expect(lastShouldDisable()).toBe(true)
    act(() => { vi.advanceTimersByTime(100) })
    expect(lastShouldDisable()).toBe(false)
  })
})
