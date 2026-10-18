import { copyText } from './clipboard'

afterEach(() => { vi.unstubAllGlobals() })

it('writes the text to the clipboard', async () => {
  const writeText = vi.fn(() => Promise.resolve())
  vi.stubGlobal('navigator', { clipboard: { writeText } })
  await expect(copyText('12.5, -3.25')).resolves.toBe(true)
  expect(writeText).toHaveBeenCalledWith('12.5, -3.25')
})

it('logs a refusal instead of throwing', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new Error('denied')) } })
  await expect(copyText('x')).resolves.toBe(false)
  expect(error).toHaveBeenCalled()
  error.mockRestore()
})

it('logs when the clipboard is unavailable', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('navigator', {})
  await expect(copyText('x')).resolves.toBe(false)
  expect(error).toHaveBeenCalled()
  error.mockRestore()
})
