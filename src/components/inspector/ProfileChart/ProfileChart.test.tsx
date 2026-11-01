import { render, screen } from '@testing-library/react'
import { inspectorLines } from 'services/inspector/inspectorLayers'
import { formatValue } from 'services/inspector/inspectorStatistics'
import type { ChartSelection } from 'services/inspector/chartSelection'
import { makeResults } from 'components/inspector/inspectorTestUtils'
import { ProfileChart } from './ProfileChart'

const feo = inspectorLines.find(line => line.id === 'feo_lp_grs')!
const picked: ChartSelection = { unit: 'wt%', picks: [{ lineId: feo.id, unit: 'wt%', slot: 0 }] }

const draw = (results = makeResults('line'), lengthKm = 4) => render(
  <ProfileChart lines={inspectorLines} results={results} selection={picked} units={['wt%', 'ppm']}
    lengthKm={lengthKm} onSelectUnit={() => {}} onTogglePick={() => {}} />
).container

const yLabels = (container: HTMLElement) =>
  [...container.querySelectorAll('[aria-hidden="true"] > span')].map(label => label.textContent)

describe('ProfileChart', () => {
  it('centers a constant profile on its value', () => {
    const container = draw(makeResults('line', { feo_lp_grs: { profile: [5, 5, null, 5] } }))
    expect(yLabels(container)).toEqual([6, 5.5, 5, 4.5, 4].map(v => formatValue(v, feo.decimals)))
  })

  it('draws every sample at the start of a line of zero length', () => {
    const d = draw(makeResults('line'), 0).querySelector(`path[data-line="${feo.id}"]`)!.getAttribute('d')!
    expect([...d.matchAll(/[ML]([\d.]+) /g)].map(m => m[1])).toEqual(['0.00', '0.00', '0.00'])
  })

  it('draws a line without samples, as one under two vertices gives', () => {
    const d = draw({ ...makeResults('line'), samples: undefined }, 0).querySelector(`path[data-line="${feo.id}"]`)!.getAttribute('d')!
    expect(d).toMatch(/^M0\.00 /)
  })

  it('keeps a picked layer whose samples all failed, without a series or scale', () => {
    const container = draw(makeResults('line', { feo_lp_grs: { value: undefined, failed: true, profile: undefined } }))
    expect(screen.getByRole('img', { name: `wt% profile of ${feo.symbol}` })).toBeInTheDocument()
    expect(container.querySelector(`path[data-line="${feo.id}"]`)!.getAttribute('d')).toBe('')
    expect(yLabels(container)).toEqual([])
  })
})
