import * as Cesium from 'cesium';
import { DrawingServiceBase } from './DrawingServiceBase';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

/**
 * Service responsible for creating polygon features through sequential point placement.
 * Handles multi-point polygon drawing with geodesic edges, closing line preview,
 * and completion via right-click or double-click.
 */
export class PolygonDrawingService extends DrawingServiceBase {
  // Polygon drawing state
  private positions: Cesium.Cartesian3[] = [];
  private polylineCollection: Cesium.PolylineCollection | null = null;
  private outline: Cesium.Polyline | null = null;
  private previewLine: Cesium.Polyline | null = null;
  private closingLine: Cesium.Polyline | null = null;

  /**
   * Handles a click event to add a point to the polygon.
   * @param screenPosition - The screen coordinates where the user clicked
   */
  handleClick(screenPosition: Cesium.Cartesian2): void {
    this.addPoint(screenPosition);
  }

  /**
   * Handles mouse movement to update preview and closing lines.
   * @param screenPosition - The current mouse screen coordinates
   */
  handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    if (this.positions.length === 0 || !this.polylineCollection) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (Cesium.defined(cartesian) && this.positions.length > 0) {
      const lastPosition = this.positions[this.positions.length - 1];
      const firstPosition = this.positions[0];

      // Remove old preview line
      if (this.previewLine) {
        this.polylineCollection.remove(this.previewLine);
      }

      // Add new preview line from last point to cursor
      this.previewLine = this.polylineCollection.add({
        positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
          positions: [lastPosition, cartesian],
        }),
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 0.5), // Semi-transparent cyan
        }),
      });

      // Update closing line to connect cursor back to first point (if 2+ points)
      if (this.positions.length >= 2) {
        if (this.closingLine) {
          this.polylineCollection.remove(this.closingLine);
        }

        this.closingLine = this.polylineCollection.add({
          positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
            positions: [cartesian, firstPosition],
          }),
          width: 3,
          material: Cesium.Material.fromType(Cesium.Material.ColorType, {
            color: new Cesium.Color(0, 1, 1, 0.5), // Semi-transparent cyan
          }),
        });
      }
    }
  }

  /**
   * Handles right-click to finish the polygon.
   */
  handleRightClick(): void {
    this.finishPolygon();
  }

  /**
   * Handles double-click to finish the polygon.
   */
  handleDoubleClick(): void {
    this.finishPolygon();
  }

  /**
   * Cancels polygon drawing and cleans up state.
   */
  cancel(): void {
    if (!this.viewer) return;

    // Remove polyline collection from primitives
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.outline = null;
      this.previewLine = null;
      this.closingLine = null;
    }

    // Reset polygon state
    this.positions = [];
  }

  /**
   * Cleans up resources used by polygon drawing.
   */
  destroy(): void {
    this.cancel();
  }

  /**
   * Adds a point to the polygon being drawn.
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

    // Clone and add position to polygon
    const clonedCartesian = Cesium.Cartesian3.clone(cartesian);
    this.positions.push(clonedCartesian);

    // Remove temp preview lines if they exist
    if (this.previewLine && this.polylineCollection) {
      this.polylineCollection.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.closingLine && this.polylineCollection) {
      this.polylineCollection.remove(this.closingLine);
      this.closingLine = null;
    }

    // Update or create polygon outline
    if (this.outline) {
      // Update existing outline with geodesic arcs
      this.outline.positions = (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: this.positions,
      });
    } else {
      // Create polyline collection on first point
      this.polylineCollection = new Cesium.PolylineCollection();
      this.outline = this.polylineCollection.add({
        positions: [],
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 1.0), // Solid cyan
        }),
      });
      this.viewer.scene.primitives.add(this.polylineCollection);
    }

    // Update closing line if we have 2+ points
    if (this.positions.length >= 2 && this.polylineCollection) {
      // Create/update line from last point back to first
      const firstPosition = this.positions[0];
      const lastPosition = this.positions[this.positions.length - 1];

      if (this.closingLine) {
        this.polylineCollection.remove(this.closingLine);
      }

      this.closingLine = this.polylineCollection.add({
        positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
          positions: [lastPosition, firstPosition],
        }),
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 0.7), // Slightly transparent cyan
        }),
      });
    }
  }

  /**
   * Finishes the polygon drawing and creates the final polygon feature.
   */
  private finishPolygon(): void {
    if (!this.viewer || this.positions.length < 3) {
      console.warn('Need at least 3 points to create a polygon');
      this.cancel();
      return;
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert positions to cartographic for metadata
    const cartographicPositions = this.positions.map((pos) =>
      ellipsoid.cartesianToCartographic(pos)
    );

    // Generate feature name
    const name = generateFeatureName('polygon');

    // Remove temp preview lines
    if (this.previewLine && this.polylineCollection) {
      this.polylineCollection.remove(this.previewLine);
      this.previewLine = null;
    }
    if (this.closingLine && this.polylineCollection) {
      this.polylineCollection.remove(this.closingLine);
      this.closingLine = null;
    }

    // Remove polyline collection from primitives
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.outline = null;
    }

    // Create final entity with the confirmed positions
    const entity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(this.positions),
        material: Cesium.Color.CYAN.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.CYAN,
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
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
      type: 'polygon',
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

    // Reset polygon state
    this.positions = [];
  }
}
