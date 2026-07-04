const flyToMock = vi.fn()
const viewerMock = {
  camera: {
    flyTo: flyToMock,
    positionCartographic: { height: 123456 },
  },
}

vi.mock('utils/context/ViewerContext', () => ({
  useViewer: () => ({ viewer: viewerMock }),
}))

vi.mock('hooks/useNomenclatureFeatures', () => ({
  useNomenclatureFeatures: () => ({
    features: [
      { name: 'Tycho', lon: -11.36, lat: -43.31, diameter: 85 },
      { name: 'Copernicus', lon: -20.08, lat: 9.62, diameter: 93 },
    ],
    isLoading: false,
  }),
}))

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Cesium from 'cesium'
import NomenclatureSearch from './NomenclatureSearch'

const SEARCH_LABEL = /search for a lunar feature or coordinate/i

beforeEach(() => {
  flyToMock.mockClear()
})

it('renders collapsed as an icon button by default', () => {
  render(<NomenclatureSearch />)

  expect(screen.getByRole('button', { name: SEARCH_LABEL })).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
})

it('expands into a search field when the icon button is pressed', async () => {
  const user = userEvent.setup()
  render(<NomenclatureSearch />)

  await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

  expect(screen.getByRole('combobox', { name: SEARCH_LABEL })).toBeInTheDocument()
})

it('collapses back to the icon button when the close button is pressed', async () => {
  const user = userEvent.setup()
  render(<NomenclatureSearch />)

  await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
  await user.click(screen.getByRole('button', { name: 'Close search' }))

  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: SEARCH_LABEL })).toBeInTheDocument()
})

describe('feature search', () => {
  it('lists only features matching the typed text', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), 'Tycho')

    expect(screen.getByRole('option', { name: 'Tycho' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Copernicus' })).not.toBeInTheDocument()
  })

  it('flies to the selected feature and collapses back to the icon button', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')

    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    expect(flyToMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: SEARCH_LABEL })).toBeInTheDocument()
  })
})

describe('coordinate search', () => {
  it('shows a "Fly to" option when typing a lat, lon pair', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), '12.34, 56.78')

    expect(screen.getByRole('option', { name: 'Fly to Lat 12.3400°, Lon 56.7800°' })).toBeInTheDocument()
  })

  it('includes the altitude in the option label when provided as a third value', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), '12.34, 56.78, 50000')

    expect(screen.getByRole('option', { name: 'Fly to Lat 12.3400°, Lon 56.7800°, Alt 50000m' })).toBeInTheDocument()
  })

  it('does not offer a coordinate match for plain feature-name text', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), 'Tycho')

    expect(screen.queryByText(/^Fly to/)).not.toBeInTheDocument()
  })

  it('flies to the parsed coordinate and collapses back to the icon button', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), '12.34, 56.78')

    await user.click(screen.getByRole('option', { name: /^Fly to/ }))

    expect(flyToMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('Enter key without navigating the menu', () => {
  it('flies to the top feature match when Enter is pressed right after typing', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), 'Tycho{Enter}')

    expect(flyToMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('flies to the parsed coordinate when Enter is pressed right after typing', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), '12.34, 56.78{Enter}')

    expect(flyToMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })

  it('does nothing when Enter is pressed with no results', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), 'no such place{Enter}')

    expect(flyToMock).not.toHaveBeenCalled()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('flies to the arrow-selected option, not the typed top match, once one is highlighted', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    // 'o' matches both mocked features; Tycho is listed first, Copernicus second.
    await user.type(screen.getByRole('combobox'), 'o')
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(flyToMock).toHaveBeenCalledTimes(1)
    const destination = flyToMock.mock.calls[0][0].destination as Cesium.Cartesian3
    const copernicusAltitude = Math.max(93 * 1000 * 2, 5000)
    const expected = Cesium.Cartesian3.fromDegrees(-20.08, 9.62, copernicusAltitude)

    expect(Cesium.Cartesian3.equalsEpsilon(destination, expected, Cesium.Math.EPSILON7)).toBe(true)
  })
})
