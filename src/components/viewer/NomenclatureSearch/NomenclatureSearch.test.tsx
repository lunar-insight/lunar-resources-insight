import { useState } from 'react'
import * as Cesium from 'cesium'

const flyToMock = vi.fn()
const entitiesAddMock = vi.fn((options: Cesium.Entity.ConstructorOptions) => new Cesium.Entity(options))
const entitiesRemoveMock = vi.fn()
const cartesianToCanvasCoordinatesMock = vi.fn(() => new Cesium.Cartesian2(100, 100))

const MOON_RADIUS = Cesium.Ellipsoid.MOON.maximumRadius

const viewerMock = {
  camera: {
    flyTo: flyToMock,
    positionCartographic: { height: 123456 },
    // Far overhead of (0, 0), well within view of every coordinate used in
    // these tests, so the EllipsoidalOccluder visibility check in
    // useTrackedScreenPosition doesn't hide the marker/callout.
    positionWC: Cesium.Cartesian3.fromDegrees(0, 0, MOON_RADIUS * 10),
  },
  // Left undefined: sampleTerrainMostDetailed rejects/throws synchronously on
  // an invalid provider, which useTrackedScreenPosition catches and falls
  // back to the ellipsoid-surface position, fine for these tests.
  terrainProvider: undefined as unknown as Cesium.TerrainProvider,
  entities: {
    add: entitiesAddMock,
    remove: entitiesRemoveMock,
  },
  scene: {
    globe: { ellipsoid: Cesium.Ellipsoid.MOON },
    cartesianToCanvasCoordinates: cartesianToCanvasCoordinatesMock,
    requestRender: vi.fn(),
    postRender: {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
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

const toggleFeatureInsightsMock = vi.fn()

// A minimal stand-in for FeaturesContext backed by real useState, so that
// addFeature calls actually cause NomenclatureSearch to re-render with the
// updated features list (needed to test the "already saved" row state).
vi.mock('utils/context/FeaturesContext', () => ({
  useFeaturesContext: () => {
    const [features, setFeatures] = useState<Array<{ id: string; metadata: { sourceId?: string } }>>([])
    return {
      features,
      addFeature: (feature: { id: string; metadata: { sourceId?: string } }) =>
        setFeatures((prev) => [...prev, feature]),
      toggleFeatureInsights: toggleFeatureInsightsMock,
      showFeatures: true,
      showLabels: true,
    }
  },
}))

import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import NomenclatureSearch from './NomenclatureSearch'

const SEARCH_LABEL = /search for a lunar feature or coordinate/i

beforeEach(() => {
  flyToMock.mockClear()
  entitiesAddMock.mockClear()
  entitiesRemoveMock.mockClear()
  toggleFeatureInsightsMock.mockClear()
  cartesianToCanvasCoordinatesMock.mockClear()
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

    expect(screen.getByRole('option', { name: 'Fly to Lat 12.34°, Lon 56.78°' })).toBeInTheDocument()
  })

  it('drops trailing zeros but keeps up to 6 decimal places', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), '12.3456789, 56.1')

    expect(screen.getByRole('option', { name: 'Fly to Lat 12.345679°, Lon 56.1°' })).toBeInTheDocument()
  })

  it('includes the altitude in the option label when provided as a third value', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))

    await user.type(screen.getByRole('combobox'), '12.34, 56.78, 50000')

    expect(screen.getByRole('option', { name: 'Fly to Lat 12.34°, Lon 56.78°, Alt 50000m' })).toBeInTheDocument()
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

describe('temporary search marker', () => {
  it('shows an on-map callout with Save, Analyze and dismiss actions after selecting a result', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')

    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    expect(screen.getByText('Tycho')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss marker' })).toBeInTheDocument()
  })

  it('creates a feature point and opens its insights when Analyze is pressed', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')
    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    await user.click(screen.getByRole('button', { name: 'Analyze' }))

    expect(entitiesAddMock).toHaveBeenCalledTimes(1)
    expect(toggleFeatureInsightsMock).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
  })

  it('creates a feature point without opening insights when Save is pressed', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')
    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(entitiesAddMock).toHaveBeenCalledTimes(1)
    expect(toggleFeatureInsightsMock).not.toHaveBeenCalled()
    // The callout stays open, reflecting the saved state.
    expect(screen.getByText('Saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('keeps Analyze available after saving, opening insights on the existing feature without duplicating it', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')
    await user.click(screen.getByRole('option', { name: 'Tycho' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    entitiesAddMock.mockClear()

    await user.click(screen.getByRole('button', { name: 'Analyze' }))

    expect(entitiesAddMock).not.toHaveBeenCalled() // no duplicate feature created
    expect(toggleFeatureInsightsMock).toHaveBeenCalledTimes(1)
  })

  it('dismisses the marker without saving when the dismiss button is pressed', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')
    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    await user.click(screen.getByRole('button', { name: 'Dismiss marker' }))

    expect(entitiesAddMock).not.toHaveBeenCalled() // no feature created
    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
  })

  it('does not clear the marker when the search box is closed', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')
    await user.click(screen.getByRole('option', { name: 'Tycho' }))

    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('saving a feature point from the dropdown', () => {
  it('saves silently, without moving the camera or opening the callout', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')

    const option = screen.getByRole('option', { name: 'Tycho' })
    await user.click(within(option).getByRole('button', { name: 'Save as feature point' }))

    expect(entitiesAddMock).toHaveBeenCalledTimes(1)
    expect(flyToMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'Analyze' })).not.toBeInTheDocument()
    // Popover should stay open.
    expect(screen.getByRole('option', { name: 'Tycho' })).toBeInTheDocument()
  })

  it('marks the result as already saved and disables the save button', async () => {
    const user = userEvent.setup()
    render(<NomenclatureSearch />)
    await user.click(screen.getByRole('button', { name: SEARCH_LABEL }))
    await user.type(screen.getByRole('combobox'), 'Tycho')

    const option = screen.getByRole('option', { name: 'Tycho' })
    await user.click(within(option).getByRole('button', { name: 'Save as feature point' }))

    const savedButton = within(screen.getByRole('option', { name: 'Tycho' })).getByRole('button', {
      name: 'Already saved as feature point',
    })
    expect(savedButton).toBeDisabled()
  })
})
