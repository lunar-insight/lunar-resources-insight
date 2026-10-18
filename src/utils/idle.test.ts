import { runWhenIdle } from './idle'

afterEach(() => {
  delete (window as Partial<Window>).requestIdleCallback
  delete (window as Partial<Window>).cancelIdleCallback
  vi.useRealTimers()
})

it('runs the callback once the browser is idle, and can cancel it', () => {
  let idle: () => void = () => {}
  window.requestIdleCallback = vi.fn((callback: () => void) => { idle = callback; return 3 }) as never
  window.cancelIdleCallback = vi.fn()
  const callback = vi.fn()

  const cancel = runWhenIdle(callback)
  expect(callback).not.toHaveBeenCalled()
  idle()
  expect(callback).toHaveBeenCalledTimes(1)
  cancel()
  expect(window.cancelIdleCallback).toHaveBeenCalledWith(3)
})

it('runs the callback on the next task without idle callbacks, and can cancel it', () => {
  vi.useFakeTimers()
  const callback = vi.fn()
  runWhenIdle(callback)
  vi.runAllTimers()
  expect(callback).toHaveBeenCalledTimes(1)

  const cancelled = vi.fn()
  runWhenIdle(cancelled)()
  vi.runAllTimers()
  expect(cancelled).not.toHaveBeenCalled()
})
