import { render, screen } from '@testing-library/react'
import { useAppSettings } from 'utils/context/AppSettingsContext'
import { useGlobePopup } from 'utils/context/GlobePopupContext'
import { usePointDrop } from 'utils/context/PointDropContext'
import { useToast } from 'utils/context/ToastContext'

// Stands in for a component and reads the settings, globe popup, point drop
// and toast contexts, so the render fails if a provider is missing above it.
const { stub } = vi.hoisted(() => ({
  stub: (name: string) => ({
    default: function Stub() {
      const { reduceMotion } = useAppSettings()
      const { popup } = useGlobePopup()
      const { drops } = usePointDrop()
      const { toast } = useToast()
      return <span>{`${name} ${reduceMotion} ${popup} ${drops.length} ${toast}`}</span>
    },
  }),
}))

vi.mock('services/LayerStatsService', () => ({ initializeLayerStats: vi.fn(() => Promise.resolve()) }))
vi.mock('services/ColormapService', () => ({ initializeColormapService: () => Promise.resolve() }))
vi.mock('utils/context/LayerContext', () => ({ LayerProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('utils/context/InspectorContext', () => ({ InspectorProvider: ({ children }: { children: React.ReactNode }) => children }))
vi.mock('components/navigation/SectionNavigation/SectionNavigation', () => ({ ...stub('rail'), dialogs: [] }))
vi.mock('components/viewer/CesiumComponent/CesiumComponent', () => ({ default: (): null => null }))
vi.mock('components/viewer/CompassWidget/CompassWidget', () => ({ default: (): null => null }))
vi.mock('components/viewer/NomenclatureSearch/NomenclatureSearch', () => ({ default: (): null => null }))
vi.mock('components/viewer/MeasurementOverlay/MeasurementOverlay', () => ({ default: (): null => null }))
vi.mock('components/navigation/FeaturesSection/components/FeaturePointsOverlay', () => stub('points'))
vi.mock('components/viewer/PointDrop/PointDropOverlay', () => stub('drops'))
vi.mock('components/viewer/GlobeMenu/GlobeContextMenu', () => stub('menu'))
vi.mock('components/viewer/Toast/ToastRegion', () => stub('toasts'))
vi.mock('components/layout/Sidebar/Sidebar', () => ({ default: (): null => null }))
vi.mock('components/inspector/InspectorWindows', () => ({ InspectorWindows: (): null => null }))
vi.mock('components/inspector/ComparisonView/ComparisonView', () => ({ ComparisonView: (): null => null }))
vi.mock('components/layout/TopBar/TopBar', () => ({ default: (): null => null }))
vi.mock('components/layout/BottomBar/BottomBar', () => ({ default: (): null => null }))

import MainPage from './MainPage'

it('provides the settings, the globe popup, the point drops and the toasts to the viewer and the rail', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  render(<MainPage />)
  for (const name of ['rail', 'points', 'drops', 'menu', 'toasts']) {
    expect(screen.getByText(`${name} false null 0 null`)).toBeInTheDocument()
  }
})

it('logs a service that fails to start', async () => {
  const { initializeLayerStats } = await import('services/LayerStatsService')
  vi.spyOn(console, 'log').mockImplementation(() => {})
  const error = vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.mocked(initializeLayerStats).mockRejectedValueOnce(new Error('offline'))
  render(<MainPage />)
  await vi.waitFor(() => expect(error).toHaveBeenCalledWith('Error initializing services:', expect.any(Error)))
})
