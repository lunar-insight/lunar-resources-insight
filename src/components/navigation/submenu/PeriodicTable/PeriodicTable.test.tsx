import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PeriodicTable, { ALL_ELEMENTS_FLAT } from './PeriodicTable'

const onElementSelect = vi.fn()

const element = (name: string) => {
  const found = ALL_ELEMENTS_FLAT.find(el => el.name === name)
  if (!found) throw new Error(`No element ${name}`)
  return found
}
const option = (name: string) => {
  const found = screen.getAllByRole('option').find(item => item.textContent?.includes(name))
  if (!found) throw new Error(`No option ${name}`)
  return found
}

const table = (selected: string[] = []) => (
  <PeriodicTable onElementSelect={onElementSelect} selectedElements={selected.map(element)} />
)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PeriodicTable selection', () => {
  it('shows the selected elements', () => {
    render(table(['Thorium']))
    expect(option('Thorium')).toHaveAttribute('aria-selected', 'true')
    expect(option('Iron')).toHaveAttribute('aria-selected', 'false')
  })

  it('reports an element pressed to add it', async () => {
    render(table())
    await userEvent.click(option('Thorium'))
    expect(onElementSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'Thorium' }))
  })

  it('reports an element pressed to remove it, and only that one', async () => {
    render(table(['Thorium', 'Iron']))
    await userEvent.click(option('Thorium'))
    expect(onElementSelect).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ name: 'Thorium' }))
  })

  it('does nothing on an element without data', async () => {
    render(table())
    expect(option('Gold')).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(option('Gold'))
    expect(onElementSelect).not.toHaveBeenCalled()
  })

  it('reports nothing on select all', async () => {
    render(table(['Thorium', 'Iron']))
    option('Thorium').focus()
    await userEvent.keyboard('{Control>}a{/Control}')
    expect(onElementSelect).not.toHaveBeenCalled()
  })
})
