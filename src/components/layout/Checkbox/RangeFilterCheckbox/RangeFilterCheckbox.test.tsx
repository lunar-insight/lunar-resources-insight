import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useLayerContext } from 'utils/context/LayerContext'
import { RangeFilterCheckbox } from './RangeFilterCheckbox'

vi.mock('utils/context/LayerContext', () => ({
  useLayerContext: vi.fn(),
}))

const updateLayerRangeFilter = vi.fn()

beforeEach(() => {
  updateLayerRangeFilter.mockReset()
  vi.mocked(useLayerContext).mockReturnValue({ updateLayerRangeFilter } as any)
})

const checkbox = () => screen.getByRole('checkbox', { name: 'Filter values outside range' })

it('starts unticked', () => {
  render(<RangeFilterCheckbox layerId="iron_ch2_class" />)
  expect(checkbox()).not.toBeChecked()
})

it('updates the range filter of its layer on each toggle', async () => {
  render(<RangeFilterCheckbox layerId="iron_ch2_class" />)

  await userEvent.click(checkbox())
  expect(checkbox()).toBeChecked()
  expect(updateLayerRangeFilter).toHaveBeenLastCalledWith('iron_ch2_class', true)

  await userEvent.click(checkbox())
  expect(checkbox()).not.toBeChecked()
  expect(updateLayerRangeFilter).toHaveBeenLastCalledWith('iron_ch2_class', false)
})

it('is disabled and inert without a layer', async () => {
  render(<RangeFilterCheckbox />)
  expect(checkbox()).toBeDisabled()

  await userEvent.click(checkbox())
  expect(checkbox()).not.toBeChecked()
  expect(updateLayerRangeFilter).not.toHaveBeenCalled()
})
