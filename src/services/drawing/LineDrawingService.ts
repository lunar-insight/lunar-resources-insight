import * as Cesium from 'cesium';
import { DrawingServiceBase } from './DrawingServiceBase';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

/**
 * Service responsible for creating line features through sequential point placement.
 * Handles multi-point line drawing with geodesic arcs, mouse movement preview,
 * and completion via right-click or double-click.
 */
export class LineDrawingService extends DrawingServiceBase {
  // Line drawing state
  private positions: Cesium.Cartesian3[] = [];
  private polylineCollection: Cesium.PolylineCollection | null = null;
  private mainPolyline: Cesium.Polyline | null = null;
  private tempPreviewLine: Cesium.Polyline | null = null;

  /**
   * Handles a click event to add a point to the line.
   * @param screenPosition - The screen coordinates where the user clicked
   */
  handleClick(screenPosition: Cesium.Cartesian2): void {
    this.addPoint(screenPosition);
  }

  /**
   * Handles mouse movement to update the preview line.
   * @param screenPosition - The current mouse screen coordinates
   */
  handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    if (this.positions.length === 0 || !this.polylineCollection) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (Cesium.defined(cartesian) && this.positions.length > 0) {
      const lastPosition = this.positions[this.positions.length - 1];

      // Remove old temp line
      if (this.tempPreviewLine) {
        this.polylineCollection.remove(this.tempPreviewLine);
      }

      // Add new temp preview line with arc positions
      this.tempPreviewLine = this.polylineCollection.add({
        positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
          positions: [lastPosition, cartesian],
        }),
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 0.5),
        }),
      });
    }
  }

  /**
   * Handles right-click to finish the line.
   */
  handleRightClick(): void {
    this.finishLine();
  }

  /**
   * Handles double-click to finish the line.
   */
  handleDoubleClick(): void {
    this.finishLine();
  }

  /**
   * Cancels line drawing and cleans up state.
   */
  cancel(): void {
    if (!this.viewer) return;

    // Remove polyline collection from primitives
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.mainPolyline = null;
      this.tempPreviewLine = null;
    }

    // Reset line state
    this.positions = [];
  }

  /**
   * Cleans up resources used by line drawing.
   */
  destroy(): void {
    this.cancel();
  }

  /**
   * Adds a point to the line being drawn.
   * @param screenPosition - The screen coordinates for the new point
   */
  private addPoint(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    // Check for duplicate position
    const lastPosition = this.positions[this.positions.length - 1];
    if (lastPosition && Cesium.Cartesian3.equals(lastPosition, cartesian)) {
      return;
    }

    // Clone and add position to line
    const clonedCartesian = Cesium.Cartesian3.clone(cartesian);
    this.positions.push(clonedCartesian);

    // Remove temp preview line if it exists
    if (this.tempPreviewLine && this.polylineCollection) {
      this.polylineCollection.remove(this.tempPreviewLine);
      this.tempPreviewLine = null;
    }

    // Update or create main polyline
    if (this.mainPolyline) {
      // Generate arc positions to follow globe curvature
      this.mainPolyline.positions = (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: this.positions,
      });
    } else {
      // Create polyline collection on first point
      this.polylineCollection = new Cesium.PolylineCollection();
      this.mainPolyline = this.polylineCollection.add({
        positions: [],
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 1.0),
        }),
      });
      this.viewer.scene.primitives.add(this.polylineCollection);
    }
  }

  /**
   * Finishes the line drawing and creates the final line feature.
   */
  private finishLine(): void {
    if (!this.viewer || this.positions.length < 2) {
      console.warn('Need at least 2 points to create a line');
      this.cancel();
      return;
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert positions to cartographic for metadata
    const cartographicPositions = this.positions.map((pos) =>
      ellipsoid.cartesianToCartographic(pos)
    );

    // Generate feature name
    const name = generateFeatureName('line');

    // Remove temp preview line
    if (this.tempPreviewLine && this.polylineCollection) {
      this.polylineCollection.remove(this.tempPreviewLine);
      this.tempPreviewLine = null;
    }

    // Remove polyline collection from primitives
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.mainPolyline = null;
    }

    // Create final entity with the confirmed positions
    const entity = this.viewer.entities.add({
      polyline: {
        positions: this.positions,
        width: 3,
        material: Cesium.Color.CYAN,
        arcType: Cesium.ArcType.GEODESIC,
        clampToGround: true,
        show: this.showFeatures,
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
        show: this.showFeatures && this.showLabels,
      },
      position: this.positions[0], // Position label at first point
    });

    // Create feature object
    const feature: Feature = {
      id: entity.id,
      type: 'line',
      name,
      entity,
      color: '#00FFFFFF',
      metadata: {
        positions: cartographicPositions,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onFeatureCreated) {
      this.onFeatureCreated(feature);
    }

    // Reset line state
    this.positions = [];
  }
}
