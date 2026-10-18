import { act, renderHook } from '@testing-library/react'
import { AppSettingsProvider, REDUCE_MOTION_STORAGE_KEY, useAppSettings } from './AppSettingsContext'

type Listener = (event: { matches: boolean }) => void

function mockSystemPreference(matches: boolean) {
  const listeners = new Set<Listener>()
  const query = {
    matches,
    addEventListener: (_type: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: Listener) => listeners.delete(listener),
  }
  window.matchMedia = vi.fn(() => query) as unknown as typeof window.matchMedia
  return {
    change: (next: boolean) => listeners.forEach(listener => listener({ matches: next })),
    listenerCount: () => listeners.size,
  }
}

const renderSettings = () => renderHook(() => useAppSettings(), { wrapper: AppSettingsProvider })

beforeEach(() => { window.localStorage.clear() })
afterEach(() => {
  // jsdom has no matchMedia of its own.
  delete (window as Partial<Window>).matchMedia
  vi.restoreAllMocks()
})

it('follows the system preference until the user chooses', () => {
  const system = mockSystemPreference(true)
  const { result, unmount } = renderSettings()
  expect(result.current.reduceMotion).toBe(true)

  act(() => system.change(false))
  expect(result.current.reduceMotion).toBe(false)

  unmount()
  expect(system.listenerCount()).toBe(0)
})

it('keeps a choice over the system preference and stores it', () => {
  const system = mockSystemPreference(false)
  const { result } = renderSettings()

  act(() => result.current.setReduceMotion(true))
  expect(result.current.reduceMotion).toBe(true)
  expect(window.localStorage.getItem(REDUCE_MOTION_STORAGE_KEY)).toBe('true')

  act(() => system.change(false))
  expect(result.current.reduceMotion).toBe(true)
})

it('reads a stored choice', () => {
  mockSystemPreference(true)
  window.localStorage.setItem(REDUCE_MOTION_STORAGE_KEY, 'false')
  expect(renderSettings().result.current.reduceMotion).toBe(false)
})

it('defaults to off without a system preference', () => {
  expect(renderSettings().result.current.reduceMotion).toBe(false)
})

it('works when browser storage is blocked', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
  const { result } = renderSettings()
  expect(result.current.reduceMotion).toBe(false)

  act(() => result.current.setReduceMotion(true))
  expect(result.current.reduceMotion).toBe(true)
})

it('requires its provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(() => useAppSettings())).toThrow('useAppSettings must be used within an AppSettingsProvider')
})
