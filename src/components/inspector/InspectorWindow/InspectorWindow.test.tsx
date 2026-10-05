import { useEffect } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('components/layout/DraggableBoxContentContainer/DraggableBoxContentContainer', () => ({
  default: ({ isOpen, title, children, onClose }: {
    isOpen: boolean; title: React.ReactNode; children: React.ReactNode; onClose: () => void
  }) => (isOpen ? (
    <section aria-label="Inspector window">
      <h3>{title}</h3>
      <button onClick={onClose}>close window</button>
      {children}
    </section>
  ) : null),
}))

vi.mock('components/reference/BoundaryRefProvider', () => ({
  useBoundaryRef: (): { current: null } => ({ current: null }),
}))

const csv = vi.hoisted(() => ({ downloadCsv: vi.fn() }))
vi.mock('services/inspector/inspectorCsv', async importOriginal => ({
  ...(await importOriginal<typeof import('services/inspector/inspectorCsv')>()),
  downloadCsv: csv.downloadCsv,
}))

import { ViewerProvider } from 'utils/context/ViewerContext'
import { FeaturesProvider, useFeaturesContext } from 'utils/context/FeaturesContext'
import { InspectorProvider, useInspectorContext } from 'utils/context/InspectorContext'
import { layerStatsService } from 'services/LayerStatsService'
import type { Feature } from 'components/navigation/FeaturesSection/types'
import type { FeatureResults } from 'services/inspector/InspectorStore'
import { deg, fakeStore, makeFeature, makeResults, moonStats, shapeStats } from '../inspectorTestUtils'
import { InspectorWindows } from '../InspectorWindows'

let inspector: ReturnType<typeof useInspectorContext>
let features: ReturnType<typeof useFeaturesContext>

function Probe({ seed }: { seed: Feature[] }): null {
  features = useFeaturesContext()
  inspector = useInspectorContext()
  useEffect(() => { seed.forEach(f => features.addFeature(f)) }, [])
  return null
}

async function renderWindow(feature: Feature, results?: FeatureResults) {
  const store = fakeStore({ [feature.id]: results })
  render(
    <ViewerProvider><FeaturesProvider><InspectorProvider store={store}>
      <Probe seed={[feature]} />
      <InspectorWindows />
    </InspectorProvider></FeaturesProvider></ViewerProvider>
  )
  await act(async () => { await Promise.resolve() })
  return store
}

const polygon = makeFeature({
  id: 'plateau', name: 'Aristarchus Plateau', type: 'polygon',
  metadata: { createdAt: new Date(0), positions: [deg(-52, 20), deg(-43, 20), deg(-43, 28), deg(-52, 28)] },
})
const point = makeFeature({ id: 'apollo', name: 'Apollo 15', type: 'point', metadata: { createdAt: new Date(0), position: deg(3.634, 26.132) } })
const line = makeFeature({ id: 'traverse', name: 'Imbrium traverse', type: 'line', metadata: { createdAt: new Date(0), positions: [deg(-21.4, 38.1), deg(-16, 33.6)] } })

const lineOf = (id: string) => document.querySelector(`[data-line="${id}"]`) as HTMLElement

beforeEach(() => {
  csv.downloadCsv.mockClear()
  vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue(moonStats)
  vi.spyOn(layerStatsService, 'retryMissing').mockResolvedValue()
})

describe('shape window', () => {
  it('shows the header facts and elevation', async () => {
    await renderWindow(polygon, makeResults('shape', {}, { elevation: { value: -1293.4, lowest: -2000, highest: 150 } }))
    expect(screen.getByText('Inspector: Aristarchus Plateau')).toBeInTheDocument()
    const meta = screen.getByText('Type').parentElement!
    expect(meta).toHaveTextContent('Type polygon')
    expect(meta).toHaveTextContent('Center 24.1°N 47.5°W')
    expect(meta).toHaveTextContent(/Area [\d,]+ km²/)
    expect(screen.getByTitle('Mean over the area. Lowest -2,000 m, highest 150 m')).toHaveTextContent('Elevation -1,293 m mean')
  })

  it('lists cards by category with one line per dataset', async () => {
    await renderWindow(polygon, makeResults('shape'))
    expect(screen.getByRole('region', { name: 'Chemical Elements' })).toHaveTextContent(/^Chemical Elements24/)
    expect(screen.getByRole('region', { name: 'Minerals' })).toBeInTheDocument()
    expect(lineOf('thorium_grs')).toHaveTextContent('LP GRS0.5° low-alt')
    expect(lineOf('thorium_grs')).toHaveTextContent('avg 11.0 ppm')
    expect(lineOf('feo_clementine_cnn_qiu2025')).toHaveTextContent(/avg [\d.]+ wt%/)
  })

  it('shows the spread icon, low resolution and partial coverage', async () => {
    await renderWindow(polygon, makeResults('shape', {
      thorium_grs: { stats: shapeStats(11), resolutionKm: 45 },
      thorium_kaguya_grs: { stats: shapeStats(11), resolutionKm: 1000 },
      iron_ch2_class: { stats: shapeStats(11, { coverage: 71 }) },
    }))
    expect(within(lineOf('thorium_grs')).getByRole('button', { name: 'Uniform' })).toBeInTheDocument()
    expect(within(lineOf('thorium_kaguya_grs')).getByRole('button', { name: 'Low resolution' })).toBeInTheDocument()
    await userEvent.click(within(lineOf('iron_ch2_class')).getByRole('button', { name: 'Partial data, 71%' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('Covered71% of the area')
  })

  it('shows no data with an explanation', async () => {
    await renderWindow(polygon, makeResults('shape', {
      olivine_kaguya_sp_lemelin2022: { value: undefined, stats: undefined, noData: 'outside', extent: 'the poles, from 50° latitude' },
    }))
    const nodata = lineOf('olivine_kaguya_sp_lemelin2022')
    expect(within(nodata).getAllByRole('button', { name: 'No data' })).toHaveLength(2)
    await userEvent.click(within(nodata).getByText('No data'))
    expect(screen.getByRole('dialog')).toHaveTextContent('This dataset covers the poles, from 50° latitude.')
  })

  it('filters the layer list', async () => {
    await renderWindow(polygon, makeResults('shape'))
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter layers' }), 'plagio')
    expect(screen.queryByRole('region', { name: 'Chemical Elements' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Minerals' })).toHaveTextContent(/^Minerals2/)

    await userEvent.clear(screen.getByRole('textbox', { name: 'Filter layers' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Filter layers' }), 'nothing at all')
    expect(screen.getByText('No layer matches the filter.')).toBeInTheDocument()
  })

  it('exports the statistics as CSV', async () => {
    await renderWindow(polygon, makeResults('shape'))
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(csv.downloadCsv).toHaveBeenCalledWith('aristarchus-plateau-statistics.csv', expect.stringContaining('Symbol,Name,Dataset'))
  })

  it('adds the feature to the comparison and opens it', async () => {
    await renderWindow(polygon, makeResults('shape'))
    await userEvent.click(screen.getByRole('button', { name: 'Compare features' }))
    expect(inspector.comparedIds.has('plateau')).toBe(true)
    expect(inspector.isComparisonOpen).toBe(true)
  })

  it('shows one computing state with the count', async () => {
    await renderWindow(polygon, { ...makeResults('shape'), status: 'computing', done: 12 })
    expect(screen.getByRole('status')).toHaveTextContent('Computing12 of 46 layers')
    expect(screen.queryByRole('region', { name: 'Chemical Elements' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeDisabled()
    expect(screen.getByRole('textbox', { name: 'Filter layers' })).toBeDisabled()
  })

  it('offers a retry after failed requests', async () => {
    const store = await renderWindow(polygon, makeResults('shape', { thorium_grs: { value: undefined, failed: true } }, { failedRequests: 1 }))
    expect(within(lineOf('thorium_grs')).getByRole('button', { name: 'Not computed' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(store.retry).toHaveBeenCalledWith('plateau')
  })

  it('retries missing statistics on open and closes', async () => {
    await renderWindow(polygon, makeResults('shape'))
    expect(layerStatsService.retryMissing).toHaveBeenCalled()
    await userEvent.click(screen.getByText('close window'))
    expect(features.features[0].inspectorOpen).toBe(false)
    expect(screen.queryByText('Inspector: Aristarchus Plateau')).not.toBeInTheDocument()
  })
})

describe('point window', () => {
  it('labels no value with "avg" and shows the coordinates', async () => {
    await renderWindow(point, makeResults('point', {}, { elevation: { value: -1069, lowest: -1069, highest: -1069 } }))
    expect(screen.getByText('Type').parentElement).toHaveTextContent('Lat 26.132°N')
    expect(screen.getByTitle('Elevation at the point')).toHaveTextContent('-1,069 m')
    expect(lineOf('thorium_grs')).not.toHaveTextContent('avg')
    expect(within(lineOf('thorium_grs')).queryByRole('button', { name: 'Uniform' })).not.toBeInTheDocument()
  })

  it('shows Computing before any results', async () => {
    await renderWindow(point, undefined)
    expect(screen.getByRole('status')).toHaveTextContent(/^Computing$/)
  })
})

describe('line window', () => {
  it('draws a sparkline per line and a chart per unit', async () => {
    await renderWindow(line, makeResults('line', {}, { elevation: { value: -2180, lowest: -2640, highest: -1720 } }))
    expect(screen.getByTitle('Mean along the line. Lowest -2,640 m, highest -1,720 m')).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'wt%' })).toBeChecked()
    expect(screen.getByText('Pick a wt% layer with the chart button on its row.')).toBeInTheDocument()
    expect(lineOf('feo_clementine_cnn_qiu2025').querySelector('svg path')).not.toBeNull()
    expect(within(lineOf('thorium_grs')).getByRole('button', { name: 'Th · LP GRS on the chart' })).toBeInTheDocument()
  })

  it('adds a layer from its row and removes it from its legend tag', async () => {
    await renderWindow(line, makeResults('line'))
    await userEvent.click(within(lineOf('thorium_kaguya_grs')).getByRole('button', { name: 'Th · Kaguya on the chart' }))
    expect(screen.getByRole('radio', { name: 'ppm, 1 picked' })).toBeChecked()

    await userEvent.click(screen.getByRole('button', { name: 'Remove Th · Kaguya from the chart' }))
    expect(screen.getByRole('radio', { name: 'ppm' })).toBeChecked()
    expect(screen.getByText('Pick a ppm layer with the chart button on its row.')).toBeInTheDocument()
  })

  it('disables the filter and the sparkline switch while computing', async () => {
    await renderWindow(line, { ...makeResults('line'), status: 'computing', done: 3 })
    expect(screen.getByRole('textbox', { name: 'Filter layers' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Moon scale' })).toBeDisabled()
    expect(screen.getByRole('radio', { name: 'Own range' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Export CSV: statistics or profile' })).toBeDisabled()
  })

  it('switches unit charts and sparkline scales', async () => {
    await renderWindow(line, makeResults('line'))
    await userEvent.click(screen.getByRole('radio', { name: 'index' }))
    expect(screen.getByRole('radio', { name: 'index' })).toBeChecked()
    await userEvent.click(screen.getByRole('radio', { name: 'Own range' }))
    expect(screen.getByRole('radio', { name: 'Own range' })).toBeChecked()
  })

  it('exports the statistics or the profile', async () => {
    await renderWindow(line, makeResults('line'))
    await userEvent.click(screen.getByRole('button', { name: 'Export CSV: statistics or profile' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Profile' }))
    expect(csv.downloadCsv).toHaveBeenLastCalledWith('imbrium-traverse-profile.csv', expect.stringContaining('Distance (km)'))

    await userEvent.click(screen.getByRole('button', { name: 'Export CSV: statistics or profile' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Statistics' }))
    expect(csv.downloadCsv).toHaveBeenLastCalledWith('imbrium-traverse-statistics.csv', expect.stringContaining('point samples'))
  })

  it('disables the chart button of a full unit', async () => {
    await renderWindow(line, makeResults('line'))
    const wt = ['silicon_lp_grs', 'silicon_ch2_class', 'titanium_lp_grs', 'oxygen_lp_grs', 'magnesium_lp_grs',
      'magnesium_ch2_class', 'iron_lp_grs', 'iron_ch2_class']
    for (const id of wt) await userEvent.click(within(lineOf(id)).getByRole('button', { name: /on the chart/ }))
    expect(screen.getByText('Chart full: remove a layer to add another.')).toBeInTheDocument()
    expect(within(lineOf('calcium_lp_grs')).getByRole('button', { name: /on the chart/ })).toBeDisabled()
  })
})
