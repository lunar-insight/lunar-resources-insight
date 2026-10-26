import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import HelpButton from './HelpButton'

it('opens the mouse gestures, then the touch gestures', async () => {
  const user = userEvent.setup()
  render(<HelpButton />)

  await user.click(screen.getByRole('button', { name: 'Show navigation help' }))
  const dialog = screen.getByRole('dialog', { name: 'Navigation' })
  expect(within(dialog).getByRole('tab', { name: 'Mouse' })).toHaveAttribute('aria-selected', 'true')
  expect(within(dialog).getByText('Left click + drag')).toBeInTheDocument()

  await user.click(within(dialog).getByRole('tab', { name: 'Touch' }))
  expect(within(dialog).getByText('Two finger pinch')).toBeInTheDocument()
  expect(within(dialog).queryByText('Left click + drag')).not.toBeInTheDocument()
})

it('loads the illustrations from Cesium static assets', async () => {
  const user = userEvent.setup()
  const { baseElement } = render(<HelpButton />)

  await user.click(screen.getByRole('button', { name: 'Show navigation help' }))
  const sources = [...baseElement.querySelectorAll('img')].map(img => img.getAttribute('src'))
  expect(sources).toContain('/cesiumStatic/Widgets/Images/NavigationHelp/MouseLeft.svg')
})
