import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ValueBar } from './ValueBar'
import styles from './ValueBar.module.scss'

const track = (container: HTMLElement) => container.querySelector('[data-state]') as HTMLElement
const popover = { title: 'T', lines: [] as [string, string][] }

describe('ValueBar', () => {
  it('fills up to the value', () => {
    const { container } = render(<ValueBar view={{ kind: 'value', position: 0.42, popover }} categoryRgb="1, 2, 3" />)
    expect(container.querySelector(`.${styles.fill}`)).toHaveStyle({ width: '42%' })
    expect(screen.getByRole('button', { name: 'Bar scale' })).toHaveStyle({ '--cat': '1, 2, 3' })
  })

  it('hatches the track for no data, with no fill', () => {
    const { container } = render(<ValueBar view={{ kind: 'no-data', popover }} categoryRgb="0, 0, 0" />)
    expect(track(container)).toHaveClass(styles.noData)
    expect(container.querySelector(`.${styles.fill}`)).toBeNull()
    expect(screen.getByRole('button', { name: 'No data' })).toBeInTheDocument()
  })

  it('draws a center dash without a scale or a value', () => {
    const noScale = render(<ValueBar view={{ kind: 'no-scale', popover }} categoryRgb="0, 0, 0" />).container
    expect(track(noScale)).toHaveClass(styles.dash)
    const failed = render(<ValueBar view={{ kind: 'failed', popover }} categoryRgb="0, 0, 0" />).container
    expect(track(failed)).toHaveClass(styles.dash)
  })

  it('opens its popover on press', async () => {
    render(<ValueBar view={{ kind: 'no-scale', popover: { title: 'Scale unavailable', lines: [], sentence: 'Retry.' } }} categoryRgb="0, 0, 0" />)
    await userEvent.click(screen.getByRole('button', { name: 'Scale unavailable' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Retry.')
  })
})
