import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { RailNotice } from 'utils/context/PointDropContext'

vi.mock('../ChemistrySection/ChemistrySection', () => ({ default: (): null => null }))
vi.mock('../GeographicalLayersSection/GeographicalLayersSection', () => ({ default: (): null => null }))
vi.mock('../MineralsSection/MineralsSection', () => ({ default: (): null => null }))
vi.mock('../ViewerOptionsSection/ViewerOptionsSection', () => ({ default: (): null => null }))
vi.mock('../FeaturesSection/FeaturesSection', () => ({ default: (): null => null }))
vi.mock('../SettingsSection/SettingsSection', () => ({ default: () => <p>Settings content</p> }))
vi.mock('hooks/useMouseTrackingControl', () => ({ useMouseTrackingControl: (): undefined => undefined }))

const openDialogs = new Set<string>()
const openDialog = vi.fn()
const closeDialog = vi.fn()
vi.mock('utils/DialogWindowManagement', () => ({
  useDialogContext: () => ({ openDialog, closeDialog, isDialogOpen: (id: string) => openDialogs.has(id) }),
}))

const sidebar = { isSidebarOpen: false, toggleSidebar: vi.fn() }
vi.mock('utils/context/SidebarContext', () => ({ useSidebarContext: () => sidebar }))

const dropState: { railNotice: RailNotice | null } = { railNotice: null }
vi.mock('utils/context/PointDropContext', () => ({ usePointDrop: () => dropState }))

import SectionNavigation, { dialogs } from './SectionNavigation'
import styles from './SectionNavigation.module.scss'

const railButton = (label: string) => screen.getByRole('button', { name: new RegExp(`${label}$`) })

beforeEach(() => {
  openDialogs.clear()
  openDialog.mockClear()
  closeDialog.mockClear()
  sidebar.isSidebarOpen = false
  sidebar.toggleSidebar.mockClear()
  dropState.railNotice = null
})

it('gives the Settings dialog its content', () => {
  const settings = dialogs.find(dialog => dialog.id === 'application-setting-dialog')
  render(<>{settings?.content as React.ReactNode}</>)
  expect(screen.getByText('Settings content')).toBeInTheDocument()
  expect(settings?.title).toBe('Application Settings')
})

it('marks the Features button as the fly target', () => {
  render(<SectionNavigation />)
  const features = railButton('Features')
  expect(features).toHaveAttribute('data-rail-id', 'features-dialog')
  expect(features.querySelector('[data-fly-target]')).toHaveTextContent('shapes')
})

it('pulses the Features button and shows +1 when a point lands', () => {
  dropState.railNotice = { key: 3, kind: 'receive' }
  render(<SectionNavigation />)
  const features = railButton('Features')
  expect(features.querySelector(`.${styles.receive}`)).toBeInTheDocument()
  expect(features.querySelector(`.${styles.bump}`)).toBeInTheDocument()
  expect(features).toHaveTextContent('+1')
  expect(railButton('Settings')).not.toHaveTextContent('+1')
})

it('only lights up the Features button with reduced motion', () => {
  dropState.railNotice = { key: 4, kind: 'notice' }
  render(<SectionNavigation />)
  const features = railButton('Features')
  expect(features.querySelector(`.${styles.notice}`)).toBeInTheDocument()
  expect(features.querySelector(`.${styles.bump}`)).not.toBeInTheDocument()
  expect(features).not.toHaveTextContent('+1')
})

it('opens and closes dialogs', async () => {
  const { rerender } = render(<SectionNavigation />)
  await userEvent.click(railButton('Settings'))
  expect(openDialog).toHaveBeenCalledWith('application-setting-dialog')

  openDialogs.add('application-setting-dialog')
  rerender(<SectionNavigation />)
  expect(railButton('Settings').className).toContain(styles.active)
  await userEvent.click(railButton('Settings'))
  expect(closeDialog).toHaveBeenCalledWith('application-setting-dialog')
})

it('toggles the layer sidebar, its chevron following its state', async () => {
  const { rerender } = render(<SectionNavigation />)
  expect(railButton('chevron_right')).toHaveTextContent('Layers')
  await userEvent.click(railButton('chevron_right'))
  expect(sidebar.toggleSidebar).toHaveBeenCalled()

  sidebar.isSidebarOpen = true
  rerender(<SectionNavigation />)
  expect(railButton('chevron_left')).toHaveTextContent('Layers')
})
