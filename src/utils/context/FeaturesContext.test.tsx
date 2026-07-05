import { act, renderHook } from '@testing-library/react'
import * as Cesium from 'cesium'
import { ViewerProvider } from './ViewerContext'
import { FeaturesProvider, useFeaturesContext } from './FeaturesContext'
import { Feature } from 'components/navigation/FeaturesSection/types'
import { formatCoordinateFeatureName } from 'utils/featurePointNaming'

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ViewerProvider>
    <FeaturesProvider>{children}</FeaturesProvider>
  </ViewerProvider>
)

const makeFeature = (overrides: Partial<Feature>): Feature => ({
  id: 'feature-1',
  type: 'point',
  name: 'unnamed',
  entity: {} as Cesium.Entity,
  color: '#00FFFFFF',
  metadata: { createdAt: new Date() },
  insightsOpen: false,
  visible: true,
  ...overrides,
})

describe('updateFeaturePosition', () => {
  it('renames a coordinate-origin point to match its new position, when still auto-named', () => {
    const { result } = renderHook(() => useFeaturesContext(), { wrapper })

    act(() => result.current.addFeature(makeFeature({
      name: formatCoordinateFeatureName(-11.36, -43.31),
      metadata: { createdAt: new Date(), sourceId: 'coordinate--43.310000--11.360000', autoNamedFromCoordinate: true },
    })))

    const newPosition = Cesium.Cartographic.fromDegrees(12.5, 34.25)
    act(() => result.current.updateFeaturePosition('feature-1', newPosition))

    expect(result.current.features[0].name).toBe(formatCoordinateFeatureName(12.5, 34.25))
  })

  it('clears the sourceId link so the search dropdown offers to save it again', () => {
    const { result } = renderHook(() => useFeaturesContext(), { wrapper })

    act(() => result.current.addFeature(makeFeature({
      name: formatCoordinateFeatureName(-11.36, -43.31),
      metadata: { createdAt: new Date(), sourceId: 'coordinate--43.310000--11.360000', autoNamedFromCoordinate: true },
    })))

    act(() => result.current.updateFeaturePosition('feature-1', Cesium.Cartographic.fromDegrees(12.5, 34.25)))

    expect(result.current.features[0].metadata.sourceId).toBeUndefined()
  })

  it('does not rename a point saved from a named nomenclature feature', () => {
    const { result } = renderHook(() => useFeaturesContext(), { wrapper })

    act(() => result.current.addFeature(makeFeature({
      name: 'Tycho',
      metadata: { createdAt: new Date(), sourceId: 'Tycho--11.36--43.31' },
    })))

    act(() => result.current.updateFeaturePosition('feature-1', Cesium.Cartographic.fromDegrees(12.5, 34.25)))

    expect(result.current.features[0].name).toBe('Tycho')
  })

  it('does not overwrite a name the user manually changed', () => {
    const { result } = renderHook(() => useFeaturesContext(), { wrapper })

    act(() => result.current.addFeature(makeFeature({
      name: formatCoordinateFeatureName(-11.36, -43.31),
      metadata: { createdAt: new Date(), sourceId: 'coordinate--43.310000--11.360000', autoNamedFromCoordinate: true },
    })))
    act(() => result.current.renameFeature('feature-1', 'Landing Site A'))

    act(() => result.current.updateFeaturePosition('feature-1', Cesium.Cartographic.fromDegrees(12.5, 34.25)))

    expect(result.current.features[0].name).toBe('Landing Site A')
  })

  it('keeps renaming on the second and later drags, not just the first', () => {
    const { result } = renderHook(() => useFeaturesContext(), { wrapper })

    act(() => result.current.addFeature(makeFeature({
      name: formatCoordinateFeatureName(-11.36, -43.31),
      metadata: { createdAt: new Date(), sourceId: 'coordinate--43.310000--11.360000', autoNamedFromCoordinate: true },
    })))

    act(() => result.current.updateFeaturePosition('feature-1', Cesium.Cartographic.fromDegrees(12.5, 34.25)))
    expect(result.current.features[0].name).toBe(formatCoordinateFeatureName(12.5, 34.25))

    act(() => result.current.updateFeaturePosition('feature-1', Cesium.Cartographic.fromDegrees(20, -5)))
    expect(result.current.features[0].name).toBe(formatCoordinateFeatureName(20, -5))
  })
})
