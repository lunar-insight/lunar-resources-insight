import { useEffect } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('hooks/useMouseTrackingControl', () => ({ useMouseTrackingControl: vi.fn() }))

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
import { fakeStore, makeFeature, makeResults, moonStats, shapeStats } from '../inspectorTestUtils'
import { ComparisonView } from './ComparisonView'
import styles from './ComparisonView.module.scss'

function Seed({ features, compared }: { features: Feature[]; compared: string[] }): null {
  const { addFeature } = useFeaturesContext()
  const { toggleCompared, setComparisonOpen } = useInspectorContext()
  useEffect(() => {
    features.forEach(addFeature)
    setTimeout(() => {
      compared.forEach(toggleCompared)
      setComparisonOpen(true)
    }, 0)
  }, [])
  return null
}

async function renderComparison(features: Feature[], results: Record<string, FeatureResults | undefined>, compared = features.map(f => f.id)) {
  render(
    <ViewerProvider><FeaturesProvider><InspectorProvider store={fakeStore(results)}>
      <Seed features={features} compared={compared} />
      <ComparisonView />
    </InspectorProvider></FeaturesProvider></ViewerProvider>
  )
  return screen.findByRole('dialog')
}

const a = makeFeature({ id: 'a', name: 'Plateau', type: 'polygon' })
const b = makeFeature({ id: 'b', name: 'Landing site', type: 'point' })
const c = makeFeature({ id: 'c', name: 'Basin', type: 'three-point-circle' })

const row = (dialog: HTMLElement, dataset: string, index = 0) =>
  within(dialog).getAllByText(dataset, { selector: 'td' })[index].closest('tr') as HTMLTableRowElement

beforeEach(() => {
  csv.downloadCsv.mockClear()
  vi.spyOn(layerStatsService, 'getFileStats').mockReturnValue(moonStats)
})

describe('ComparisonView', () => {
  it('asks for features when none is ticked', async () => {
    const dialog = await renderComparison([a], { a: makeResults('shape') }, [])
    expect(dialog).toHaveTextContent('Tick features in the Features panel to compare them.')
    expect(within(dialog).getByRole('button', { name: 'Export CSV' })).toBeDisabled()
  })

  it('heads each column with the feature and whether it holds an average', async () => {
    const dialog = await renderComparison([a, b], { a: makeResults('shape'), b: makeResults('point') })
    const headers = within(dialog).getAllByRole('columnheader').map(th => th.textContent)
    expect(headers).toEqual(['Layer', 'Plateaupolygon · average', 'Landing sitepoint'])
  })

  it('highlights the highest value of a dataset row', async () => {
    const dialog = await renderComparison([a, b], {
      a: makeResults('shape', { thorium_kaguya_grs: { value: 9, stats: shapeStats(9) } }),
      b: makeResults('point', { thorium_kaguya_grs: { value: 4 } }),
    })
    const cells = row(dialog, 'Kaguya GRS').querySelectorAll('td')
    expect(cells[1]).toHaveClass(styles.best)
    expect(cells[1]).toHaveTextContent('9.0')
    expect(cells[2]).not.toHaveClass(styles.best)
  })

  it('mutes a cell under 50% coverage, which never takes the highlight', async () => {
    const dialog = await renderComparison([a, c, b], {
      a: makeResults('shape', { thorium_kaguya_grs: { value: 20, stats: shapeStats(20, { coverage: 42 }) } }),
      c: makeResults('shape', { thorium_kaguya_grs: { value: 8, stats: shapeStats(8) } }),
      b: makeResults('point', { thorium_kaguya_grs: { value: 4 } }),
    })
    const cells = row(dialog, 'Kaguya GRS').querySelectorAll('td')
    expect(cells[1]).toHaveClass(styles.lowCoverage)
    expect(within(cells[1]).getByRole('button', { name: 'Partial data, 42%' })).toBeInTheDocument()
    expect(cells[2]).toHaveClass(styles.best)
    expect(cells[3]).not.toHaveClass(styles.best)
  })

  it('shows no data, computing and failed cells', async () => {
    const dialog = await renderComparison([a, b, c], {
      a: makeResults('shape', { olivine_kaguya_mi_lemelin2016: { value: undefined, stats: undefined, noData: 'outside', extent: '50°N to 50°S' } }),
      b: { ...makeResults('point'), status: 'computing' },
      c: makeResults('shape', { olivine_kaguya_mi_lemelin2016: { value: undefined, failed: true } }),
    })
    const cells = row(dialog, 'Kaguya Multiband Imager (Lemelin 2016)', 3).querySelectorAll('td')
    expect(cells[1]).toHaveTextContent('No data')
    expect(cells[2]).toHaveTextContent('Computing')
    expect(within(cells[3]).getByRole('button', { name: 'Not computed' })).toBeInTheDocument()

    await userEvent.click(within(cells[1]).getByText('No data'))
    expect(screen.getAllByRole('dialog').at(-1)).toHaveTextContent('This dataset covers 50°N to 50°S.')
  })

  it('names each symbol once with its unit', async () => {
    const dialog = await renderComparison([a], { a: makeResults('shape') })
    expect(within(dialog).getByText('Iron oxide').closest('tr')).toHaveTextContent('FeOIron oxidewt%')
    expect(within(dialog).getByText('Chemical Elements')).toBeInTheDocument()
  })

  it('lists no rows for features without results', async () => {
    const dialog = await renderComparison([a], { a: undefined })
    expect(within(dialog).queryByText('Chemical Elements')).not.toBeInTheDocument()
  })

  it('exports every compared feature as CSV', async () => {
    const dialog = await renderComparison([a, b], { a: makeResults('shape'), b: makeResults('point') })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Export CSV' }))
    const [name, text] = csv.downloadCsv.mock.calls[0]
    expect(name).toBe('feature-comparison.csv')
    expect(text).toContain('Plateau,polygon,')
    expect(text).toContain('Landing site,point,')
  })
})
