import { act, renderHook } from '@testing-library/react'

const copyText = vi.fn()
vi.mock('utils/clipboard', () => ({ copyText: (text: string) => copyText(text) }))
const showToast = vi.fn()
vi.mock('utils/context/ToastContext', () => ({ useToast: () => ({ showToast }) }))

import { useCopyCoordinates } from './useCopyCoordinates'

beforeEach(() => {
  copyText.mockReset()
  showToast.mockClear()
})

it('copies lat, lon with 6 decimals and confirms it', async () => {
  copyText.mockResolvedValue(true)
  const { result } = renderHook(() => useCopyCoordinates())
  await act(() => result.current(-18.2145371, -32.08816))
  expect(copyText).toHaveBeenCalledWith('-18.214537, -32.088160')
  expect(showToast).toHaveBeenCalledWith({ icon: 'check', message: 'Coordinates copied', detail: '-18.214537, -32.088160' })
})

it('tells when the browser refuses the copy', async () => {
  copyText.mockResolvedValue(false)
  const { result } = renderHook(() => useCopyCoordinates())
  await act(() => result.current(1, 2))
  expect(showToast).toHaveBeenCalledWith({ icon: 'error', message: 'The coordinates could not be copied' })
})
