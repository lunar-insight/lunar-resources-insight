import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatPopover } from './StatPopover'

describe('StatPopover', () => {
  it('opens on press with the title, then label and value lines', async () => {
    render(
      <StatPopover label="Uniform" content={{ title: 'Uniform', lines: [['Most', '1 to 2 wt%'], ['Lowest', '0']] }}>
        icon
      </StatPopover>
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Uniform' }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Uniform')
    expect(dialog).toHaveTextContent('Most1 to 2 wt%')
    expect(dialog).toHaveTextContent('Lowest0')
    expect(dialog.querySelector('p')).toBeNull()
  })

  it('shows one sentence for a fact without a value', async () => {
    render(
      <StatPopover label="No data" tooltip="No data" content={{ title: 'No data', lines: [], sentence: 'This dataset covers 50°N to 50°S.' }}>
        No data
      </StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'No data' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('This dataset covers 50°N to 50°S.')
    expect(screen.getByRole('dialog').querySelector('dl')).toBeNull()
  })

  it('closes on Escape', async () => {
    render(<StatPopover label="Bar scale" content={{ title: 'Percentile', lines: [] }}>bar</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Bar scale' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
