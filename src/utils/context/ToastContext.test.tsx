import { act, render, renderHook, screen } from '@testing-library/react'
import { AppSettingsProvider } from './AppSettingsContext'
import { TOAST_DURATION, TOAST_EXIT_DURATION, ToastProvider, useToast } from './ToastContext'
import ToastRegion from 'components/viewer/Toast/ToastRegion'

let toasts: ReturnType<typeof useToast>
function Probe(): null {
  toasts = useToast()
  return null
}

const renderRegion = () => render(
  <AppSettingsProvider><ToastProvider><Probe /><ToastRegion /></ToastProvider></AppSettingsProvider>
)

beforeEach(() => {
  vi.useFakeTimers()
  window.localStorage.clear()
})
afterEach(() => { vi.useRealTimers() })

it('shows a toast in a live region, then fades it out and removes it', () => {
  renderRegion()
  const region = screen.getByRole('status')
  expect(region).toBeEmptyDOMElement()

  act(() => toasts.showToast({ icon: 'check', message: 'Coordinates copied', detail: '1.000000, 2.000000' }))
  expect(region).toHaveTextContent('checkCoordinates copied1.000000, 2.000000')
  expect(region.firstElementChild).not.toHaveAttribute('data-leaving')

  act(() => { vi.advanceTimersByTime(TOAST_DURATION) })
  expect(region.firstElementChild).toHaveAttribute('data-leaving', 'true')

  act(() => { vi.advanceTimersByTime(TOAST_EXIT_DURATION) })
  expect(region).toBeEmptyDOMElement()
})

it('replaces a toast and gives the new one its full time', () => {
  renderRegion()
  act(() => toasts.showToast({ icon: 'check', message: 'First' }))
  act(() => { vi.advanceTimersByTime(TOAST_DURATION - 100) })
  act(() => toasts.showToast({ icon: 'error', message: 'Second' }))
  expect(screen.getByRole('status')).toHaveTextContent('errorSecond')

  act(() => { vi.advanceTimersByTime(TOAST_DURATION - 100) })
  expect(screen.getByRole('status').firstElementChild).not.toHaveAttribute('data-leaving')
  expect(screen.getByRole('status')).not.toHaveTextContent('First')
})

it('only fades with reduced motion', () => {
  window.localStorage.setItem('lri:reduce-motion', 'true')
  renderRegion()
  act(() => toasts.showToast({ icon: 'check', message: 'Copied' }))
  expect(screen.getByRole('status').firstElementChild).toHaveAttribute('data-reduce-motion', 'true')
})

it('stops its timers when unmounted', () => {
  const { unmount } = renderRegion()
  const before = vi.getTimerCount()
  act(() => toasts.showToast({ icon: 'check', message: 'Copied' }))
  expect(vi.getTimerCount()).toBe(before + 2)
  unmount()
  expect(vi.getTimerCount()).toBe(before)
})

it('requires its provider', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  expect(() => renderHook(() => useToast())).toThrow('useToast must be used within a ToastProvider')
})
