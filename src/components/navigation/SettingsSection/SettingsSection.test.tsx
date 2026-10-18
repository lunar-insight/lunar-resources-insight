import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppSettingsProvider } from 'utils/context/AppSettingsContext'
import SettingsSection from './SettingsSection'

beforeEach(() => { window.localStorage.clear() })

it('switches reduced motion on and off', async () => {
  render(<AppSettingsProvider><SettingsSection /></AppSettingsProvider>)
  const checkbox = screen.getByRole('checkbox', { name: 'Reduce motion' })
  expect(checkbox).not.toBeChecked()

  await userEvent.click(checkbox)
  expect(checkbox).toBeChecked()

  await userEvent.click(checkbox)
  expect(checkbox).not.toBeChecked()
})

it('explains the option', async () => {
  render(<AppSettingsProvider><SettingsSection /></AppSettingsProvider>)
  await userEvent.click(screen.getByRole('button', { name: 'Info about reduced motion' }))
  expect(await screen.findByText(/Replaces moving animations with fades/)).toBeInTheDocument()
})
