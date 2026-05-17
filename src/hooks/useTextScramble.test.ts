import { act, renderHook } from '@testing-library/react'
import { useTextScramble } from './useTextScramble'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn().mockReturnValue(1))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ─── scrambleIndices ──────────────────────────────────────────────────────────

describe('scrambleIndices', () => {
  it('includes indices of all non-space characters', () => {
    const { result } = renderHook(() => useTextScramble('Hello World', { enabled: false }))
    // space at index 5 is excluded
    expect(result.current.scrambleIndices).toEqual([0, 1, 2, 3, 4, 6, 7, 8, 9, 10])
  })

  it('is empty for an empty string', () => {
    const { result } = renderHook(() => useTextScramble('', { enabled: false }))
    expect(result.current.scrambleIndices).toEqual([])
  })

  it('is empty when text is only spaces', () => {
    const { result } = renderHook(() => useTextScramble('   ', { enabled: false }))
    expect(result.current.scrambleIndices).toEqual([])
  })

  it('updates when targetText changes', () => {
    const { result, rerender } = renderHook(
      ({ text }) => useTextScramble(text, { enabled: false }),
      { initialProps: { text: 'Hi' } }
    )
    expect(result.current.scrambleIndices).toEqual([0, 1])

    rerender({ text: 'Hello' })
    expect(result.current.scrambleIndices).toEqual([0, 1, 2, 3, 4])
  })
})

// ─── enabled: false ───────────────────────────────────────────────────────────

describe('when enabled is false', () => {
  it('displays the target text immediately', () => {
    const { result } = renderHook(() => useTextScramble('Hello', { enabled: false }))
    expect(result.current.displayText).toBe('Hello')
  })

  it('is not animating', () => {
    const { result } = renderHook(() => useTextScramble('Hello', { enabled: false }))
    expect(result.current.isAnimating).toBe(false)
  })

  it('revealedCount equals total scramble-able characters', () => {
    const { result } = renderHook(() => useTextScramble('Hello', { enabled: false }))
    expect(result.current.revealedCount).toBe(result.current.scrambleIndices.length)
  })

  it('does not call requestAnimationFrame', () => {
    renderHook(() => useTextScramble('Hello', { enabled: false }))
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })
})

// ─── enabled: true (default) ──────────────────────────────────────────────────

describe('when enabled is true', () => {
  it('starts animating on mount', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    expect(result.current.isAnimating).toBe(true)
  })

  it('revealedCount starts at 0', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    expect(result.current.revealedCount).toBe(0)
  })

  it('schedules a requestAnimationFrame', () => {
    renderHook(() => useTextScramble('Hello'))
    expect(requestAnimationFrame).toHaveBeenCalled()
  })
})

// ─── reset ────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('stops the animation', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    act(() => result.current.reset())
    expect(result.current.isAnimating).toBe(false)
  })

  it('resets revealedCount to 0', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    act(() => result.current.reset())
    expect(result.current.revealedCount).toBe(0)
  })

  it('restores displayText to the target text', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    act(() => result.current.reset())
    expect(result.current.displayText).toBe('Hello')
  })

  it('cancels the pending animation frame', () => {
    const { result } = renderHook(() => useTextScramble('Hello'))
    act(() => result.current.reset())
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1)
  })
})
