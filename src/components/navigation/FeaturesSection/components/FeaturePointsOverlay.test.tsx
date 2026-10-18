import * as Cesium from 'cesium'
import { render, screen } from '@testing-library/react'
import type { Feature } from '../types'

const viewerState: { viewer: unknown } = { viewer: {} }
vi.mock('utils/context/ViewerContext', () => ({ useViewer: () => viewerState }))

const featuresState: { features: Feature[] } = { features: [] }
vi.mock('utils/context/FeaturesContext', () => ({ useFeaturesContext: () => featuresState }))

const popupState: { popup: unknown } = { popup: null }
vi.mock('utils/context/GlobePopupContext', () => ({ useGlobePopup: () => popupState }))

vi.mock('./FeaturePointMarker', () => ({ default: ({ feature }: { feature: Feature }) => <span>marker {feature.id}</span> }))
vi.mock('./FeatureCallout', () => ({ default: ({ feature }: { feature: Feature }) => <span>box {feature.id}</span> }))

import FeaturePointsOverlay from './FeaturePointsOverlay'

const makeFeature = (id: string, type: Feature['type'], position?: Cesium.Cartographic): Feature => ({
  id,
  type,
  name: id,
  entity: {} as Cesium.Entity,
  color: '#00FFFFFF',
  metadata: { position, createdAt: new Date() },
  inspectorOpen: false,
  visible: true,
})

beforeEach(() => {
  viewerState.viewer = {}
  popupState.popup = null
  featuresState.features = [
    makeFeature('p1', 'point', Cesium.Cartographic.fromDegrees(1, 2)),
    makeFeature('l1', 'line'),
    makeFeature('p2', 'point'),
  ]
})

it('draws a marker for every point', () => {
  render(<FeaturePointsOverlay />)
  expect(screen.getAllByText(/^marker/).map(el => el.textContent)).toEqual(['marker p1', 'marker p2'])
  expect(screen.queryByText(/^box/)).not.toBeInTheDocument()
})

it('draws the box of the point whose box is open', () => {
  popupState.popup = { kind: 'feature', featureId: 'p1' }
  render(<FeaturePointsOverlay />)
  expect(screen.getByText('box p1')).toBeInTheDocument()
})

it('draws no box for a feature without a position or one that is gone', () => {
  popupState.popup = { kind: 'feature', featureId: 'p2' }
  const { rerender } = render(<FeaturePointsOverlay />)
  expect(screen.queryByText(/^box/)).not.toBeInTheDocument()

  popupState.popup = { kind: 'feature', featureId: 'deleted' }
  rerender(<FeaturePointsOverlay />)
  expect(screen.queryByText(/^box/)).not.toBeInTheDocument()

  popupState.popup = { kind: 'menu' }
  rerender(<FeaturePointsOverlay />)
  expect(screen.queryByText(/^box/)).not.toBeInTheDocument()
})

it('draws nothing without a viewer', () => {
  viewerState.viewer = null
  const { container } = render(<FeaturePointsOverlay />)
  expect(container).toBeEmptyDOMElement()
})
