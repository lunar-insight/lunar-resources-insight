import { useEffect } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ViewerProvider } from 'utils/context/ViewerContext'
import { FeaturesProvider, useFeaturesContext } from 'utils/context/FeaturesContext'
import { InspectorProvider, useInspectorContext } from 'utils/context/InspectorContext'
import type { Feature } from '../types'
import { fakeStore, makeFeature, makeResults } from 'components/inspector/inspectorTestUtils'
import { FeaturesList } from './FeaturesList'

let inspector: ReturnType<typeof useInspectorContext>
let features: ReturnType<typeof useFeaturesContext>

function Probe({ seed }: { seed: Feature[] }): null {
  features = useFeaturesContext()
  inspector = useInspectorContext()
  useEffect(() => { seed.forEach(features.addFeature) }, [])
  return null
}

function renderList(seed: Feature[], store = fakeStore()) {
  render(
    <ViewerProvider><FeaturesProvider><InspectorProvider store={store}>
      <Probe seed={seed} />
      <FeaturesList />
    </InspectorProvider></FeaturesProvider></ViewerProvider>
  )
  return store
}

const point = makeFeature({ id: 'p', name: 'Apollo 15', type: 'point', inspectorOpen: false })
const circle = makeFeature({ id: 'c', name: 'Basin', type: 'two-point-circle', inspectorOpen: false })

const rowOf = (name: string) => screen.getByRole('row', { name })

describe('FeaturesList', () => {
  it('shows a placeholder without features', () => {
    renderList([])
    expect(screen.getByText('No features selected')).toBeInTheDocument()
  })

  it('shows each shape type with its progress or ready state', () => {
    const store = fakeStore({
      p: makeResults('point'),
      c: { ...makeResults('shape'), status: 'computing', done: 29 },
    })
    renderList([point, circle], store)
    expect(rowOf('Apollo 15')).toHaveTextContent('point·46 layers ready')
    expect(rowOf('Basin')).toHaveTextContent('circle·29 of 46 layers')
    expect(within(rowOf('Basin')).getByText('circle', { selector: '[title]' })).toBeInTheDocument()

    act(() => store.set('c', undefined))
    expect(rowOf('Basin')).toHaveTextContent('circle·Computing')
  })

  it('ticks features for the comparison and opens it', async () => {
    renderList([point, circle])
    expect(screen.getByRole('button', { name: 'Compare (0)' })).toBeDisabled()

    await userEvent.click(within(rowOf('Apollo 15')).getByRole('checkbox', { name: 'Add to comparison' }))
    expect(inspector.comparedIds.has('p')).toBe(true)
    expect(screen.getByText('1 ticked')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Compare (1)' }))
    expect(inspector.isComparisonOpen).toBe(true)
  })

  it('opens and closes the Inspector of a feature', async () => {
    renderList([point])
    const inspect = within(rowOf('Apollo 15')).getByRole('button', { name: 'Inspect' })
    await userEvent.click(inspect)
    expect(features.features[0].inspectorOpen).toBe(true)
    expect(inspect).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(inspect)
    expect(features.features[0].inspectorOpen).toBe(false)
  })

  it('renames, hides and removes a feature', async () => {
    renderList([point])
    await userEvent.click(screen.getByText('Apollo 15'))
    const input = screen.getByRole('textbox')
    await userEvent.clear(input)
    await userEvent.type(input, 'Hadley{Enter}')
    expect(features.features[0].name).toBe('Hadley')

    await userEvent.click(within(rowOf('Hadley')).getByRole('button', { name: 'remove shape' }))
    expect(features.features).toHaveLength(0)
  })
})
