import { act, renderHook } from '@testing-library/react'
import { ScannerProvider, useScannerContext } from './ScannerContext'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ScannerProvider>{children}</ScannerProvider>
)

// ─── Initial state ────────────────────────────────────────────────────────────

describe('initial state', () => {
  it('all scanners are off by default', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    expect(result.current.showElementScanner).toBe(false)
    expect(result.current.showCompoundScanner).toBe(false)
    expect(result.current.showDerivedIndexScanner).toBe(false)
  })

  it('anyScannerOpen is false by default', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    expect(result.current.anyScannerOpen).toBe(false)
  })
})

// ─── Individual toggles ───────────────────────────────────────────────────────

describe('toggleElementScanner', () => {
  it('turns the element scanner on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleElementScanner(true))
    expect(result.current.showElementScanner).toBe(true)
  })

  it('turns the element scanner off', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleElementScanner(true))
    act(() => result.current.toggleElementScanner(false))
    expect(result.current.showElementScanner).toBe(false)
  })
})

describe('toggleCompoundScanner', () => {
  it('turns the compound scanner on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleCompoundScanner(true))
    expect(result.current.showCompoundScanner).toBe(true)
  })

  it('turns the compound scanner off', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleCompoundScanner(true))
    act(() => result.current.toggleCompoundScanner(false))
    expect(result.current.showCompoundScanner).toBe(false)
  })
})

describe('toggleDerivedIndexScanner', () => {
  it('turns the derived index scanner on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleDerivedIndexScanner(true))
    expect(result.current.showDerivedIndexScanner).toBe(true)
  })

  it('turns the derived index scanner off', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleDerivedIndexScanner(true))
    act(() => result.current.toggleDerivedIndexScanner(false))
    expect(result.current.showDerivedIndexScanner).toBe(false)
  })
})

// ─── anyScannerOpen derived value ─────────────────────────────────────────────

describe('anyScannerOpen', () => {
  it('is true when only the element scanner is on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleElementScanner(true))
    expect(result.current.anyScannerOpen).toBe(true)
  })

  it('is true when only the compound scanner is on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleCompoundScanner(true))
    expect(result.current.anyScannerOpen).toBe(true)
  })

  it('is true when only the derived index scanner is on', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => result.current.toggleDerivedIndexScanner(true))
    expect(result.current.anyScannerOpen).toBe(true)
  })

  it('is false after all scanners are turned off', () => {
    const { result } = renderHook(() => useScannerContext(), { wrapper })
    act(() => {
      result.current.toggleElementScanner(true)
      result.current.toggleCompoundScanner(true)
      result.current.toggleDerivedIndexScanner(true)
    })
    act(() => {
      result.current.toggleElementScanner(false)
      result.current.toggleCompoundScanner(false)
      result.current.toggleDerivedIndexScanner(false)
    })
    expect(result.current.anyScannerOpen).toBe(false)
  })
})

// ─── Guard ────────────────────────────────────────────────────────────────────

describe('useScannerContext outside provider', () => {
  it('throws when used outside ScannerProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useScannerContext())).toThrow(
      'useScannerContext must be used within a ScannerProvider'
    )
    vi.restoreAllMocks()
  })
})
