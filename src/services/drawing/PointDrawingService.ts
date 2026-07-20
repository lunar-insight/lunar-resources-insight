import * as Cesium from 'cesium';
import { DrawingServiceBase } from './DrawingServiceBase';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

/**
 * Creates a point Feature (entity + metadata) at a given world position.
 * Shared by manual point drawing and any other flow that needs to place
 * a feature point at a known position (e.g. saving a search result).
 *
 * The Cesium entity created here is position-only (no point/label graphics).
 * It exists purely for id/lifecycle bookkeeping (removeFeature, cleanup on
 * unmount); the visual dot and label are rendered separately as a DOM
 * overlay (FeaturePointMarker) rather than Cesium graphics, since
 * CLAMP_TO_GROUND point entities are unreliable to render and pick on
 * complex terrain (flicker, a "grab" hover cursor that fails to register).
 */
export function createPointFeature(
  viewer: Cesium.Viewer,
  cartesian: Cesium.Cartesian3,
  name: string,
  sourceId?: string
): Feature {
  const ellipsoid = viewer.scene.globe.ellipsoid;
  const cartographic = ellipsoid.cartesianToCartographic(cartesian);

  const entity = viewer.entities.add({
    position: cartesian,
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
      autoNamedFromCoordinate: sourceId?.startsWith('coordinate-') ?? false,
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
    const feature = createPointFeature(this.viewer, cartesian, name);

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
