import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CheckboxWithInfo } from './CheckboxWithInfo'

const infoProps = {
  infoTooltipText: 'Info about lunar nomenclature',
  infoPopoverTitle: 'Lunar Nomenclature',
  infoPopoverBody: 'Official names of lunar features.',
}

const checkbox = () => screen.getByRole('checkbox', { name: 'Show lunar names' })

it('renders the checkbox and its info button', () => {
  render(<CheckboxWithInfo label="Show lunar names" {...infoProps} />)
  expect(checkbox()).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Info about lunar nomenclature' })).toBeInTheDocument()
})

it('toggles on its own when uncontrolled', async () => {
  const onChange = vi.fn()
  render(<CheckboxWithInfo label="Show lunar names" defaultSelected onChange={onChange} {...infoProps} />)
  expect(checkbox()).toBeChecked()

  await userEvent.click(screen.getByText('Show lunar names'))
  expect(checkbox()).not.toBeChecked()
  expect(onChange).toHaveBeenLastCalledWith(false)
})

it('follows isSelected when controlled', async () => {
  const onChange = vi.fn()
  render(<CheckboxWithInfo label="Show lunar names" isSelected={false} onChange={onChange} {...infoProps} />)

  await userEvent.click(checkbox())
  expect(onChange).toHaveBeenLastCalledWith(true)
  expect(checkbox()).not.toBeChecked()
})

it('does not toggle when the info button is pressed', async () => {
  const onChange = vi.fn()
  render(<CheckboxWithInfo label="Show lunar names" onChange={onChange} {...infoProps} />)

  await userEvent.click(screen.getByRole('button', { name: 'Info about lunar nomenclature' }))
  expect(onChange).not.toHaveBeenCalled()
  // The open popover hides the rest of the page from the accessibility tree
  expect(screen.getByRole('checkbox', { name: 'Show lunar names', hidden: true })).not.toBeChecked()
})

it('ignores clicks when disabled', async () => {
  const onChange = vi.fn()
  render(<CheckboxWithInfo label="Show lunar names" isDisabled onChange={onChange} {...infoProps} />)

  await userEvent.click(checkbox())
  expect(onChange).not.toHaveBeenCalled()
})
