import * as Cesium from 'cesium';
import { DrawingServiceBase } from './DrawingServiceBase';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

/**
 * Service responsible for creating circle features using three different modes:
 * 1. Center-radius: Click center, move mouse, click edge
 * 2. Two-point: Click two points defining the diameter
 * 3. Three-point: Click three points on the circumference
 */
export class CircleDrawingService extends DrawingServiceBase {
  // Mode tracking
  private currentMode: 'center-radius' | 'two-point' | 'three-point' | null = null;

  // Center-radius mode state
  private centerRadiusCenter: Cesium.Cartesian3 | null = null;
  private centerRadiusPreview: Cesium.Entity | null = null;
  private hasCenterRadiusCenter: boolean = false;
  private currentCenterRadiusRadius: number = 50;

  // Two-point mode state
  private twoPointPositions: Cesium.Cartesian3[] = [];
  private twoPointPreview: Cesium.Entity | null = null;
  private currentTwoPointRadius: number = 50;
  private currentTwoPointCenter: Cesium.Cartesian3 | null = null;

  // Three-point mode state
  private threePointPositions: Cesium.Cartesian3[] = [];
  private threePointPreview: Cesium.Entity | null = null;
  private threePointMarkers: Cesium.Entity[] = [];
  private currentThreePointRadius: number = 50;
  private currentThreePointCenter: Cesium.Cartesian3 | null = null;

  /**
   * Starts a specific circle drawing mode.
   * @param mode - The circle mode to activate
   */
  startMode(mode: 'center-radius' | 'two-point' | 'three-point'): void {
    this.currentMode = mode;
    this.cancel(); // Clear any previous state
  }

  /**
   * Handles click events based on the current mode.
   * @param screenPosition - The screen coordinates where the user clicked
   */
  handleClick(screenPosition: Cesium.Cartesian2): void {
    if (!this.currentMode) return;

    switch (this.currentMode) {
      case 'center-radius':
        this.handleCenterRadiusClick(screenPosition);
        break;
      case 'two-point':
        this.handleTwoPointClick(screenPosition);
        break;
      case 'three-point':
        this.handleThreePointClick(screenPosition);
        break;
    }
  }

  /**
   * Handles mouse movement for preview updates.
   * @param screenPosition - The current mouse screen coordinates
   */
  handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    if (!this.currentMode) return;

    switch (this.currentMode) {
      case 'center-radius':
        this.handleCenterRadiusMove(screenPosition);
        break;
      case 'two-point':
        this.handleTwoPointMove(screenPosition);
        break;
      case 'three-point':
        this.handleThreePointMove(screenPosition);
        break;
    }
  }

  /**
   * Cancels circle drawing and cleans up all mode states.
   */
  cancel(): void {
    if (!this.viewer) return;

    // Clean up center-radius mode
    if (this.centerRadiusPreview) {
      this.viewer.entities.remove(this.centerRadiusPreview);
      this.centerRadiusPreview = null;
    }
    this.centerRadiusCenter = null;
    this.hasCenterRadiusCenter = false;

    // Clean up two-point mode
    if (this.twoPointPreview) {
      this.viewer.entities.remove(this.twoPointPreview);
      this.twoPointPreview = null;
    }
    this.twoPointPositions = [];
    this.currentTwoPointCenter = null;

    // Clean up three-point mode
    if (this.threePointPreview) {
      this.viewer.entities.remove(this.threePointPreview);
      this.threePointPreview = null;
    }
    this.threePointMarkers.forEach(marker => {
      this.viewer!.entities.remove(marker);
    });
    this.threePointMarkers = [];
    this.threePointPositions = [];
    this.currentThreePointCenter = null;
  }

  /**
   * Cleans up resources used by circle drawing.
   */
  destroy(): void {
    this.cancel();
    this.currentMode = null;
  }

  // ===== Center-Radius Mode Methods =====

  private handleCenterRadiusClick(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    if (!this.hasCenterRadiusCenter) {
      // First click: set center
      this.centerRadiusCenter = Cesium.Cartesian3.clone(cartesian);
      this.hasCenterRadiusCenter = true;

      // Create preview circle with dynamic radius
      this.centerRadiusPreview = this.viewer.entities.add({
        position: this.centerRadiusCenter,
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => this.currentCenterRadiusRadius, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => this.currentCenterRadiusRadius, false),
          material: Cesium.Color.CYAN.withAlpha(0.5),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
    } else {
      // Second click: set radius and finish
      this.finishCenterRadiusCircle(cartesian);
    }
  }

  private handleCenterRadiusMove(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer || !this.hasCenterRadiusCenter || !this.centerRadiusCenter) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (Cesium.defined(cartesian)) {
      const ellipsoid = this.viewer.scene.globe.ellipsoid;
      const centerCarto = ellipsoid.cartesianToCartographic(this.centerRadiusCenter);
      const edgeCarto = ellipsoid.cartesianToCartographic(cartesian);

      const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, edgeCarto);
      this.currentCenterRadiusRadius = geodesic.surfaceDistance;
    }
  }

  private finishCenterRadiusCircle(edgePosition: Cesium.Cartesian3): void {
    if (!this.viewer || !this.centerRadiusCenter) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Calculate final radius
    const centerCarto = ellipsoid.cartesianToCartographic(this.centerRadiusCenter);
    const edgeCarto = ellipsoid.cartesianToCartographic(edgePosition);
    const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, edgeCarto);
    const radius = geodesic.surfaceDistance;

    // Remove preview
    if (this.centerRadiusPreview) {
      this.viewer.entities.remove(this.centerRadiusPreview);
      this.centerRadiusPreview = null;
    }

    // Create final circle
    this.createFinalCircle(
      this.centerRadiusCenter,
      radius,
      'circle',
      { centerPosition: centerCarto, radius }
    );

    // Reset state
    this.centerRadiusCenter = null;
    this.hasCenterRadiusCenter = false;
  }

  // ===== Two-Point Mode Methods =====

  private handleTwoPointClick(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    this.twoPointPositions.push(Cesium.Cartesian3.clone(cartesian));

    if (this.twoPointPositions.length === 1) {
      // First point: create preview
      this.twoPointPreview = this.viewer.entities.add({
        position: new Cesium.CallbackProperty(() => this.currentTwoPointCenter || cartesian, false) as any,
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => this.currentTwoPointRadius, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => this.currentTwoPointRadius, false),
          material: Cesium.Color.CYAN.withAlpha(0.5),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
    } else if (this.twoPointPositions.length === 2) {
      // Second point: finish circle
      this.finishTwoPointCircle();
    }
  }

  private handleTwoPointMove(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer || this.twoPointPositions.length !== 1) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (Cesium.defined(cartesian)) {
      const ellipsoid = this.viewer.scene.globe.ellipsoid;

      // Calculate midpoint (center)
      const midpoint = new Cesium.Cartesian3();
      Cesium.Cartesian3.add(this.twoPointPositions[0], cartesian, midpoint);
      Cesium.Cartesian3.multiplyByScalar(midpoint, 0.5, midpoint);

      // Project midpoint to surface
      const surfaceMidpoint = ellipsoid.scaleToGeodeticSurface(midpoint);
      if (surfaceMidpoint) {
        this.currentTwoPointCenter = surfaceMidpoint;

        // Calculate radius as half the distance between points
        const midpointCarto = ellipsoid.cartesianToCartographic(surfaceMidpoint);
        const point1Carto = ellipsoid.cartesianToCartographic(this.twoPointPositions[0]);
        const geodesic = new Cesium.EllipsoidGeodesic(midpointCarto, point1Carto);
        this.currentTwoPointRadius = geodesic.surfaceDistance;
      }
    }
  }

  private finishTwoPointCircle(): void {
    if (!this.viewer || this.twoPointPositions.length !== 2) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Calculate center (midpoint of two points)
    const midpoint = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(this.twoPointPositions[0], this.twoPointPositions[1], midpoint);
    Cesium.Cartesian3.multiplyByScalar(midpoint, 0.5, midpoint);

    // Project to surface
    const surfaceCenter = ellipsoid.scaleToGeodeticSurface(midpoint);
    if (!surfaceCenter) {
      console.warn('Could not project center to surface');
      return;
    }

    // Calculate radius
    const centerCarto = ellipsoid.cartesianToCartographic(surfaceCenter);
    const point1Carto = ellipsoid.cartesianToCartographic(this.twoPointPositions[0]);
    const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, point1Carto);
    const radius = geodesic.surfaceDistance;

    // Remove preview
    if (this.twoPointPreview) {
      this.viewer.entities.remove(this.twoPointPreview);
      this.twoPointPreview = null;
    }

    // Create final circle
    this.createFinalCircle(
      surfaceCenter,
      radius,
      'two-point-circle',
      {
        centerPosition: centerCarto,
        radius,
        diameterEndpoints: [
          ellipsoid.cartesianToCartographic(this.twoPointPositions[0]),
          ellipsoid.cartesianToCartographic(this.twoPointPositions[1])
        ]
      }
    );

    // Reset state
    this.twoPointPositions = [];
    this.currentTwoPointCenter = null;
  }

  // ===== Three-Point Mode Methods =====

  private handleThreePointClick(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    const clonedPosition = Cesium.Cartesian3.clone(cartesian);
    this.threePointPositions.push(clonedPosition);

    // Add marker for clicked point
    this.addThreePointMarker(clonedPosition, this.threePointPositions.length - 1);

    if (this.threePointPositions.length === 3) {
      // Three points: calculate and finish circle
      this.finishThreePointCircle();
    } else if (this.threePointPositions.length === 2) {
      // Two points: create preview with dynamic third point
      this.threePointPreview = this.viewer.entities.add({
        position: new Cesium.CallbackProperty(() => this.currentThreePointCenter || cartesian, false) as any,
        ellipse: {
          semiMajorAxis: new Cesium.CallbackProperty(() => this.currentThreePointRadius, false),
          semiMinorAxis: new Cesium.CallbackProperty(() => this.currentThreePointRadius, false),
          material: Cesium.Color.CYAN.withAlpha(0.5),
          outline: true,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 3,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
      });
    }
  }

  private handleThreePointMove(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer || this.threePointPositions.length !== 2) return;

    const cartesian = this.pickGlobePosition(screenPosition);

    if (Cesium.defined(cartesian)) {
      // Calculate circumcenter with the two fixed points and current mouse position
      const result = this.calculateCircumcenter(
        this.threePointPositions[0],
        this.threePointPositions[1],
        cartesian
      );

      if (result) {
        this.currentThreePointCenter = result.center;
        this.currentThreePointRadius = result.radius;
      }
    }
  }

  private finishThreePointCircle(): void {
    if (!this.viewer || this.threePointPositions.length !== 3) return;

    const result = this.calculateCircumcenter(
      this.threePointPositions[0],
      this.threePointPositions[1],
      this.threePointPositions[2]
    );

    if (!result) {
      console.warn('Could not calculate circle from three points');
      return;
    }

    // Remove preview and markers
    if (this.threePointPreview) {
      this.viewer.entities.remove(this.threePointPreview);
      this.threePointPreview = null;
    }
    this.threePointMarkers.forEach(marker => {
      this.viewer!.entities.remove(marker);
    });
    this.threePointMarkers = [];

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const centerCarto = ellipsoid.cartesianToCartographic(result.center);

    // Create final circle
    this.createFinalCircle(
      result.center,
      result.radius,
      'three-point-circle',
      {
        centerPosition: centerCarto,
        radius: result.radius,
        circumferencePoints: [
          ellipsoid.cartesianToCartographic(this.threePointPositions[0]),
          ellipsoid.cartesianToCartographic(this.threePointPositions[1]),
          ellipsoid.cartesianToCartographic(this.threePointPositions[2])
        ]
      }
    );

    // Reset state
    this.threePointPositions = [];
    this.currentThreePointCenter = null;
  }

  private addThreePointMarker(position: Cesium.Cartesian3, index: number): void {
    if (!this.viewer) return;

    const marker = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: 10,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: `${index + 1}`,
        font: '14px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -15),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });

    this.threePointMarkers.push(marker);
  }

  // ===== Geometry Helpers =====

  private calculateCircumcenter(
    p1: Cesium.Cartesian3,
    p2: Cesium.Cartesian3,
    p3: Cesium.Cartesian3
  ): { center: Cesium.Cartesian3; radius: number } | null {
    if (!this.viewer) return null;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Calculate centroid for local coordinate system origin
    const centroid = new Cesium.Cartesian3();
    Cesium.Cartesian3.add(p1, p2, centroid);
    Cesium.Cartesian3.add(centroid, p3, centroid);
    Cesium.Cartesian3.multiplyByScalar(centroid, 1 / 3, centroid);

    // Transform points to local ENU coordinate system
    const local1 = this.cartesianToLocalENU(p1, centroid);
    const local2 = this.cartesianToLocalENU(p2, centroid);
    const local3 = this.cartesianToLocalENU(p3, centroid);

    const x1 = local1.x, y1 = local1.y;
    const x2 = local2.x, y2 = local2.y;
    const x3 = local3.x, y3 = local3.y;

    // Calculate circumcenter using 2D formula
    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));

    // Check for collinear points
    const EPSILON = 1e-10;
    if (Math.abs(D) < EPSILON) {
      console.warn('Points are collinear, cannot create circle');
      return null;
    }

    const ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
    const uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;

    // Transform back to global coordinates
    const globalCenter = this.localENUToCartesian(ux, uy, centroid);

    // Clamp to ellipsoid surface
    const surfaceCenter = ellipsoid.scaleToGeodeticSurface(globalCenter);
    if (!surfaceCenter) {
      console.warn('Could not project center to surface');
      return null;
    }

    // Calculate radius using geodesic distance to first point
    const centerCarto = ellipsoid.cartesianToCartographic(surfaceCenter);
    const p1Carto = ellipsoid.cartesianToCartographic(p1);
    const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, p1Carto);
    const radius = geodesic.surfaceDistance;

    // Validate radius
    if (radius > 1000000) { // 1000 km
      console.warn('Invalid circle configuration - radius too large');
      return null;
    }

    return { center: surfaceCenter, radius };
  }

  private cartesianToLocalENU(
    position: Cesium.Cartesian3,
    origin: Cesium.Cartesian3
  ): { x: number; y: number } {
    if (!this.viewer) return { x: 0, y: 0 };

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Create ENU transformation matrix at origin
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);
    const inverseMatrix = Cesium.Matrix4.inverseTransformation(enuMatrix, new Cesium.Matrix4());

    // Transform position to local ENU coordinates
    const localPosition = Cesium.Matrix4.multiplyByPoint(
      inverseMatrix,
      position,
      new Cesium.Cartesian3()
    );

    return { x: localPosition.x, y: localPosition.y };
  }

  private localENUToCartesian(
    x: number,
    y: number,
    origin: Cesium.Cartesian3
  ): Cesium.Cartesian3 {
    if (!this.viewer) return new Cesium.Cartesian3();

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Create ENU transformation matrix at origin
    const enuMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(origin, ellipsoid);

    // Create local position (z=0 for plane projection)
    const localPosition = new Cesium.Cartesian3(x, y, 0);

    // Transform back to global coordinates
    return Cesium.Matrix4.multiplyByPoint(
      enuMatrix,
      localPosition,
      new Cesium.Cartesian3()
    );
  }

  // ===== Final Circle Creation =====

  private createFinalCircle(
    center: Cesium.Cartesian3,
    radius: number,
    type: 'circle' | 'two-point-circle' | 'three-point-circle',
    metadata: any
  ): void {
    if (!this.viewer) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const centerCarto = ellipsoid.cartesianToCartographic(center);

    // Generate feature name
    const name = generateFeatureName(type);

    // Create entity
    const entity = this.viewer.entities.add({
      position: center,
      ellipse: {
        semiMajorAxis: radius,
        semiMinorAxis: radius,
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
    });

    // Create feature object
    const feature: Feature = {
      id: entity.id,
      type,
      name,
      entity,
      color: '#00FFFFFF',
      metadata: {
        ...metadata,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onFeatureCreated) {
      this.onFeatureCreated(feature);
    }

    // Notify drawing finished
    if (this.onDrawingFinished) {
      this.onDrawingFinished();
    }
  }
}
