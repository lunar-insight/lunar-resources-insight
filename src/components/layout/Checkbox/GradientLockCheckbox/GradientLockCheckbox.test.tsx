import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayerContext } from 'utils/context/LayerContext'
import { GradientLockCheckbox } from './GradientLockCheckbox'

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: vi.fn(),
}))

const updateLayerGradientLock = vi.fn()

beforeEach(() => {
  updateLayerGradientLock.mockReset()
  vi.mocked(useLayerContext).mockReturnValue({ updateLayerGradientLock } as any)
})

const checkbox = () => screen.getByRole('checkbox', { name: 'Lock gradient to data range' })

it('starts unticked', () => {
  render(<GradientLockCheckbox layerId="thorium_kaguya_grs" />)
  expect(checkbox()).not.toBeChecked()
})

it('updates the gradient lock of its layer on each toggle', async () => {
  render(<GradientLockCheckbox layerId="thorium_kaguya_grs" />)

  await userEvent.click(checkbox())
  expect(checkbox()).toBeChecked()
  expect(updateLayerGradientLock).toHaveBeenLastCalledWith('thorium_kaguya_grs', true)

  await userEvent.click(checkbox())
  expect(checkbox()).not.toBeChecked()
  expect(updateLayerGradientLock).toHaveBeenLastCalledWith('thorium_kaguya_grs', false)
})

it('is disabled and inert without a layer', async () => {
  render(<GradientLockCheckbox />)
  expect(checkbox()).toBeDisabled()

  await userEvent.click(checkbox())
  expect(checkbox()).not.toBeChecked()
  expect(updateLayerGradientLock).not.toHaveBeenCalled()
})
