import * as Cesium from 'cesium';
import { DrawingServiceBase } from './DrawingServiceBase';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

/**
 * Creates a point Feature (entity + metadata) at a given world position.
 * Shared by manual point drawing and any other flow that needs to place
 * a feature point at a known position (e.g. saving a search result).
 */
export function createPointFeature(
  viewer: Cesium.Viewer,
  cartesian: Cesium.Cartesian3,
  name: string,
  showFeatures: boolean,
  showLabels: boolean,
  sourceId?: string
): Feature {
  const ellipsoid = viewer.scene.globe.ellipsoid;
  const cartographic = ellipsoid.cartesianToCartographic(cartesian);

  const entity = viewer.entities.add({
    position: cartesian,
    point: {
      pixelSize: 10,
      color: Cesium.Color.CYAN,
      outlineColor: Cesium.Color.WHITE,
      outlineWidth: 2,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
      show: showFeatures,
    },
    label: {
      text: name,
      font: '14px sans-serif',
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 2,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, -15),
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      show: showFeatures && showLabels,
    },
  });

  return {
    id: entity.id,
    type: 'point',
    name,
    entity,
    color: '#00FFFFFF',
    metadata: {
      position: cartographic,
      createdAt: new Date(),
      sourceId,
    },
    insightsOpen: false,
    visible: true,
  };
}

/**
 * Service responsible for creating point features on the globe.
 * Handles single-click point placement with automatic label generation.
 */
export class PointDrawingService extends DrawingServiceBase {
  /**
   * Handles a click event to create a point feature.
   * @param screenPosition - The screen coordinates where the user clicked
   */
  handleClick(screenPosition: Cesium.Cartesian2): void {
    this.createPoint(screenPosition);
  }

  /**
   * Creates a point feature at the specified screen position.
   * @param screenPosition - The screen coordinates for the point
   */
  private createPoint(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    const name = generateFeatureName('point');
    const feature = createPointFeature(this.viewer, cartesian, name, this.showFeatures, this.showLabels);

    // Notify callback
    if (this.onFeatureCreated) {
      this.onFeatureCreated(feature);
    }
  }

  /**
   * Cleans up resources. No persistent state for point drawing.
   */
  destroy(): void {
    // No cleanup needed for point drawing (stateless)
  }
}
