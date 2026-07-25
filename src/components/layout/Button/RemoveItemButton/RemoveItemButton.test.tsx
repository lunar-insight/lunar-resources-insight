import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RemoveItemButton from './RemoveItemButton'
import styles from './RemoveItemButton.module.scss'

describe('default props', () => {
  it('renders with the "remove" icon and "Remove layer" accessible name', () => {
    render(<RemoveItemButton onPress={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'remove layer' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('remove')
  })

  it('does not apply the danger icon class', () => {
    render(<RemoveItemButton onPress={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'remove layer' })
    expect(button.querySelector(`.${styles.danger}`)).not.toBeInTheDocument()
  })

  it('calls onPress when clicked', async () => {
    const onPress = vi.fn()
    render(<RemoveItemButton onPress={onPress} />)
    await userEvent.click(screen.getByRole('button', { name: 'remove layer' }))
    expect(onPress).toHaveBeenCalledOnce()
  })
})

describe('danger variant (used for shapes)', () => {
  it('renders the "delete" icon with the custom accessible name', () => {
    render(
      <RemoveItemButton
        onPress={vi.fn()}
        icon="delete"
        label="Remove shape"
        ariaLabel="remove shape"
        variant="danger"
      />
    )
    const button = screen.getByRole('button', { name: 'remove shape' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('delete')
  })

  it('applies the danger icon class', () => {
    render(
      <RemoveItemButton
        onPress={vi.fn()}
        icon="delete"
        ariaLabel="remove shape"
        variant="danger"
      />
    )
    const button = screen.getByRole('button', { name: 'remove shape' })
    expect(button.querySelector(`.${styles.danger}`)).toBeInTheDocument()
  })
})
