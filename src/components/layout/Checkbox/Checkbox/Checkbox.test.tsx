import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from './Checkbox'
import styles from './Checkbox.module.scss'

const root = (checkbox: HTMLElement) => checkbox.closest('label') as HTMLElement

describe('size', () => {
  it('is md without a label', () => {
    render(<Checkbox aria-label="Add to comparison" />)
    expect(root(screen.getByRole('checkbox', { name: 'Add to comparison' }))).toHaveClass(styles.md)
  })

  it('is sm with a label', () => {
    render(<Checkbox label="Filter values outside range" />)
    expect(root(screen.getByRole('checkbox', { name: 'Filter values outside range' }))).toHaveClass(styles.sm)
  })

  it('follows an explicit size', () => {
    render(<Checkbox label="Lock gradient" size="md" />)
    expect(root(screen.getByRole('checkbox', { name: 'Lock gradient' }))).toHaveClass(styles.md)
  })
})

describe('interaction', () => {
  it('toggles and reports the new state when the label is clicked', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Show lunar names" onChange={onChange} />)
    const checkbox = screen.getByRole('checkbox', { name: 'Show lunar names' })

    await userEvent.click(screen.getByText('Show lunar names'))
    expect(checkbox).toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(true)

    await userEvent.click(screen.getByText('Show lunar names'))
    expect(checkbox).not.toBeChecked()
    expect(onChange).toHaveBeenLastCalledWith(false)
  })

  it('follows isSelected when controlled', () => {
    render(<Checkbox label="Remove rotation lock" isSelected onChange={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: 'Remove rotation lock' })).toBeChecked()
  })

  it('ignores clicks when disabled', async () => {
    const onChange = vi.fn()
    render(<Checkbox label="Filter values outside range" isDisabled onChange={onChange} />)
    await userEvent.click(screen.getByText('Filter values outside range'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('checkbox', { name: 'Filter values outside range' })).not.toBeChecked()
  })
})
