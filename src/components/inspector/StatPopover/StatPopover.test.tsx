import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StatPopover } from './StatPopover'
import styles from './StatPopover.module.scss'

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

  it('adds the note as a second paragraph', async () => {
    render(
      <StatPopover label="Limit" content={{ title: 'At the limit', lines: [], sentence: 'First.', note: 'Second.' }}>
        icon
      </StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Limit' }))
    expect([...screen.getByRole('dialog').querySelectorAll('p')].map(p => p.textContent)).toEqual(['First.', 'Second.'])
  })

  it('places a chart below the title, before the lines', async () => {
    render(
      <StatPopover label="Variable" chart={<svg data-testid="chart" />} content={{ title: 'Variable', lines: [['Median', '6']] }}>
        icon
      </StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Variable' }))
    const dialog = screen.getByRole('dialog')
    expect([...dialog.children].map(el => el.tagName)).toEqual(['H2', 'svg', 'DL'])
  })

  it('sets the sentence and the note apart in a callout after rows', async () => {
    render(
      <StatPopover
        label="Limit"
        chart={<svg data-testid="chart" />}
        content={{ title: 'At the limit', lines: [['Limit', '24']], sentence: 'First.', note: 'Second.' }}
      >
        icon
      </StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Limit' }))
    const dialog = screen.getByRole('dialog')
    const callout = dialog.querySelector(`.${styles.callout}`)!
    expect([...callout.querySelectorAll('p')].map(p => p.textContent)).toEqual(['First.', 'Second.'])
    expect([...dialog.children].map(el => el.tagName)).toEqual(['H2', 'svg', 'DL', 'DIV'])
  })

  it('has no callout without rows or without a sentence', async () => {
    const alone = render(<StatPopover label="Alone" content={{ title: 'T', lines: [], sentence: 'Only.', note: 'Note.' }}>a</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Alone' }))
    expect(screen.getByRole('dialog').querySelector(`.${styles.callout}`)).toBeNull()
    await userEvent.keyboard('{Escape}')
    alone.unmount()

    render(<StatPopover label="Rows" content={{ title: 'T', lines: [['Median', '6']] }}>r</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Rows' }))
    expect(screen.getByRole('dialog').querySelector(`.${styles.callout}`)).toBeNull()
  })

  it('places the footer last', async () => {
    render(
      <StatPopover label="Rows" footer={<footer />} content={{ title: 'T', lines: [['Median', '6']], sentence: 'S.' }}>r</StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Rows' }))
    expect([...screen.getByRole('dialog').children].map(el => el.tagName)).toEqual(['H2', 'DL', 'DIV', 'FOOTER'])
  })

  it('reports the line under the pointer, on its term and its value', async () => {
    const onLineHover = vi.fn()
    render(
      <StatPopover label="Rows" onLineHover={onLineHover} content={{ title: 'T', lines: [['Most', '1 to 2'], ['Median', '6']] }}>r</StatPopover>
    )
    await userEvent.click(screen.getByRole('button', { name: 'Rows' }))
    await userEvent.hover(screen.getByText('Most'))
    expect(onLineHover).toHaveBeenLastCalledWith('Most')
    await userEvent.unhover(screen.getByText('Most'))
    expect(onLineHover).toHaveBeenLastCalledWith(null)
    await userEvent.hover(screen.getByText('6'))
    expect(onLineHover).toHaveBeenLastCalledWith('Median')
  })

  it('tolerates a pointer on a line with nobody listening', async () => {
    render(<StatPopover label="Rows" content={{ title: 'T', lines: [['Most', '1 to 2']] }}>r</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Rows' }))
    await userEvent.hover(screen.getByText('Most'))
    await userEvent.unhover(screen.getByText('Most'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('reports opening and closing', async () => {
    const onOpenChange = vi.fn()
    render(<StatPopover label="Rows" onOpenChange={onOpenChange} content={{ title: 'T', lines: [] }}>r</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Rows' }))
    expect(onOpenChange).toHaveBeenLastCalledWith(true)
    await userEvent.keyboard('{Escape}')
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
  })

  it('closes on Escape', async () => {
    render(<StatPopover label="Bar scale" content={{ title: 'Percentile', lines: [] }}>bar</StatPopover>)
    await userEvent.click(screen.getByRole('button', { name: 'Bar scale' }))
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
