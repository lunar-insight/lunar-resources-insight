import * as Cesium from 'cesium';
import { pointValueService } from './PointValueService';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';

export class FeatureDrawingService {
  private viewer: Cesium.Viewer | null = null;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private currentTool: string | null = null;
  private onPointCreatedCallback: ((feature: Feature) => void) | null = null;
  private onDrawingCancelledCallback: (() => void) | null = null;
  private showFeatures: boolean = true;
  private showLabels: boolean = true;

  // Line drawing state
  private linePositions: Cesium.Cartesian3[] = [];
  private polylineCollection: Cesium.PolylineCollection | null = null;
  private mainPolyline: Cesium.Polyline | null = null;
  private tempPreviewLine: Cesium.Polyline | null = null;

  // Polygon drawing state
  private polygonPositions: Cesium.Cartesian3[] = [];
  private polygonPolylineCollection: Cesium.PolylineCollection | null = null;
  private polygonOutline: Cesium.Polyline | null = null;
  private polygonPreviewLine: Cesium.Polyline | null = null;
  private polygonClosingLine: Cesium.Polyline | null = null;

  // Circle drawing state
  private circleCenter: Cesium.Cartesian3 | null = null;
  private circlePreview: Cesium.Entity | null = null;
  private hasCircleCenter: boolean = false;
  private currentCircleRadius: number = 50; // Track current radius for dynamic callback

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
  }

  setCallbacks(
    onPointCreated: (feature: Feature) => void,
    onDrawingCancelled: () => void
  ) {
    this.onPointCreatedCallback = onPointCreated;
    this.onDrawingCancelledCallback = onDrawingCancelled;
  }

  setVisibility(showFeatures: boolean, showLabels: boolean) {
    this.showFeatures = showFeatures;
    this.showLabels = showLabels;
  }

  startDrawing(tool: string) {
    if (!this.viewer) {
      console.error('Viewer not available');
      return;
    }

    this.currentTool = tool;

    // Reset circle state to ensure clean start
    if (tool === 'circle') {
      this.circleCenter = null;
      this.hasCircleCenter = false;
      if (this.circlePreview) {
        this.viewer.entities.remove(this.circlePreview);
        this.circlePreview = null;
      }
    }

    // Disable mouse tracking from PointValueService
    pointValueService.disableMouseTracking();

    // Setup click handler
    this.setupClickHandler();

    // Setup ESC key handler
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.cancelDrawing();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  private setupClickHandler() {
    if (!this.viewer) return;

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    this.handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        this.handleClick(click.position);
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
  }

  private handleClick(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer || !this.currentTool) return;

    if (this.currentTool === 'point') {
      this.createPoint(screenPosition);
    } else if (this.currentTool === 'line') {
      this.addLinePoint(screenPosition);
    } else if (this.currentTool === 'polygon') {
      this.addPolygonPoint(screenPosition);
    } else if (this.currentTool === 'circle') {
      this.handleCircleClick(screenPosition);
    }
  }

  private createPoint(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    // Convert to cartographic for metadata
    const cartographic = ellipsoid.cartesianToCartographic(cartesian);

    // Generate feature name
    const name = generateFeatureName('point');

    // Create entity
    const entity = this.viewer.entities.add({
      position: cartesian,
      point: {
        pixelSize: 10,
        color: Cesium.Color.CYAN,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
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
      type: 'point',
      name,
      entity,
      metadata: {
        position: cartographic,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onPointCreatedCallback) {
      this.onPointCreatedCallback(feature);
    }

    // Auto-stop drawing after creating point
    this.stopDrawing();
  }

  private addLinePoint(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    // Check for duplicate position
    const lastPosition = this.linePositions[this.linePositions.length - 1];
    if (lastPosition && Cesium.Cartesian3.equals(lastPosition, cartesian)) {
      return;
    }

    // Clone and add position to line
    const clonedCartesian = Cesium.Cartesian3.clone(cartesian);
    this.linePositions.push(clonedCartesian);

    // Remove temp preview line if it exists
    if (this.tempPreviewLine && this.polylineCollection) {
      this.polylineCollection.remove(this.tempPreviewLine);
      this.tempPreviewLine = null;
    }

    // Update or create main polyline
    if (this.mainPolyline) {
      // Generate arc positions to follow globe curvature
      this.mainPolyline.positions = (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: this.linePositions,
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

    // Setup mouse move handler for preview (only after first point)
    if (this.linePositions.length === 1) {
      this.setupLineMoveHandler();

      // Setup right-click to finish line
      if (this.handler) {
        this.handler.setInputAction(
          () => {
            this.finishLine();
          },
          Cesium.ScreenSpaceEventType.RIGHT_CLICK
        );

        // Also finish on double-click
        this.handler.setInputAction(
          () => {
            this.finishLine();
          },
          Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
      }
    }
  }

  private addPolygonPoint(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    // Check for duplicate position
    const lastPosition = this.polygonPositions[this.polygonPositions.length - 1];
    if (lastPosition && Cesium.Cartesian3.equals(lastPosition, cartesian)) {
      return;
    }

    // Clone and add position to polygon
    const clonedCartesian = Cesium.Cartesian3.clone(cartesian);
    this.polygonPositions.push(clonedCartesian);

    // Remove temp preview lines if they exist
    if (this.polygonPreviewLine && this.polygonPolylineCollection) {
      this.polygonPolylineCollection.remove(this.polygonPreviewLine);
      this.polygonPreviewLine = null;
    }
    if (this.polygonClosingLine && this.polygonPolylineCollection) {
      this.polygonPolylineCollection.remove(this.polygonClosingLine);
      this.polygonClosingLine = null;
    }

    // Update or create polygon outline
    if (this.polygonOutline) {
      // Update existing outline with geodesic arcs
      this.polygonOutline.positions = (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: this.polygonPositions,
      });
    } else {
      // Create polyline collection on first point
      this.polygonPolylineCollection = new Cesium.PolylineCollection();
      this.polygonOutline = this.polygonPolylineCollection.add({
        positions: [],
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 1.0), // Solid cyan
        }),
      });
      this.viewer.scene.primitives.add(this.polygonPolylineCollection);
    }

    // Setup mouse move handler for preview (only after first point)
    if (this.polygonPositions.length === 1) {
      this.setupPolygonMoveHandler();

      // Setup right-click to finish polygon
      if (this.handler) {
        this.handler.setInputAction(
          () => {
            this.finishPolygon();
          },
          Cesium.ScreenSpaceEventType.RIGHT_CLICK
        );

        // Also finish on double-click
        this.handler.setInputAction(
          () => {
            this.finishPolygon();
          },
          Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
        );
      }
    }

    // Update closing line if we have 2+ points
    if (this.polygonPositions.length >= 2 && this.polygonPolylineCollection) {
      // Create/update line from last point back to first
      const firstPosition = this.polygonPositions[0];
      const lastPosition = this.polygonPositions[this.polygonPositions.length - 1];

      if (this.polygonClosingLine) {
        this.polygonPolylineCollection.remove(this.polygonClosingLine);
      }

      this.polygonClosingLine = this.polygonPolylineCollection.add({
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

  private setupPolygonMoveHandler() {
    if (!this.viewer || !this.handler || !this.polygonPolylineCollection) return;

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (this.polygonPositions.length === 0 || !this.polygonPolylineCollection) return;

        const ellipsoid = this.viewer!.scene.globe.ellipsoid;
        const cartesian = this.viewer!.camera.pickEllipsoid(
          movement.endPosition,
          ellipsoid
        );

        if (Cesium.defined(cartesian) && this.polygonPositions.length > 0) {
          const lastPosition = this.polygonPositions[this.polygonPositions.length - 1];
          const firstPosition = this.polygonPositions[0];

          // Remove old preview line
          if (this.polygonPreviewLine) {
            this.polygonPolylineCollection.remove(this.polygonPreviewLine);
          }

          // Add new preview line from last point to cursor
          this.polygonPreviewLine = this.polygonPolylineCollection.add({
            positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
              positions: [lastPosition, cartesian],
            }),
            width: 3,
            material: Cesium.Material.fromType(Cesium.Material.ColorType, {
              color: new Cesium.Color(0, 1, 1, 0.5), // Semi-transparent cyan
            }),
          });

          // Update closing line to connect cursor back to first point (if 2+ points)
          if (this.polygonPositions.length >= 2) {
            if (this.polygonClosingLine) {
              this.polygonPolylineCollection.remove(this.polygonClosingLine);
            }

            this.polygonClosingLine = this.polygonPolylineCollection.add({
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
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
  }

  private setupLineMoveHandler() {
    if (!this.viewer || !this.handler || !this.polylineCollection) return;

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (this.linePositions.length === 0 || !this.polylineCollection) return;

        const ellipsoid = this.viewer!.scene.globe.ellipsoid;
        const cartesian = this.viewer!.camera.pickEllipsoid(
          movement.endPosition,
          ellipsoid
        );

        if (Cesium.defined(cartesian) && this.linePositions.length > 0) {
          const lastPosition = this.linePositions[this.linePositions.length - 1];

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
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
  }

  private finishLine() {
    if (!this.viewer || this.linePositions.length < 2) {
      console.warn('Need at least 2 points to create a line');
      this.cancelLineDrawing();
      return;
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert positions to cartographic for metadata
    const cartographicPositions = this.linePositions.map((pos) =>
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
        positions: this.linePositions,
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
      position: this.linePositions[0], // Position label at first point
    });

    // Create feature object
    const feature: Feature = {
      id: entity.id,
      type: 'line',
      name,
      entity,
      metadata: {
        positions: cartographicPositions,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onPointCreatedCallback) {
      this.onPointCreatedCallback(feature);
    }

    // Reset line state and stop drawing
    this.linePositions = [];
    this.stopDrawing();
  }

  private finishPolygon() {
    if (!this.viewer || this.polygonPositions.length < 3) {
      console.warn('Need at least 3 points to create a polygon');
      this.cancelPolygonDrawing();
      return;
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert positions to cartographic for metadata
    const cartographicPositions = this.polygonPositions.map((pos) =>
      ellipsoid.cartesianToCartographic(pos)
    );

    // Generate feature name
    const name = generateFeatureName('polygon');

    // Remove temporary polyline collection from primitives
    if (this.polygonPolylineCollection) {
      this.viewer.scene.primitives.remove(this.polygonPolylineCollection);
      this.polygonPolylineCollection = null;
      this.polygonOutline = null;
      this.polygonPreviewLine = null;
      this.polygonClosingLine = null;
    }

    // Create final polygon entity
    const entity = this.viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(this.polygonPositions),
        material: Cesium.Color.CYAN.withAlpha(0.3), // Semi-transparent fill
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
      position: this.polygonPositions[0], // Position label at first point
    });

    // Create feature object
    const feature: Feature = {
      id: entity.id,
      type: 'polygon',
      name,
      entity,
      metadata: {
        positions: cartographicPositions,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onPointCreatedCallback) {
      this.onPointCreatedCallback(feature);
    }

    // Reset polygon state and stop drawing
    this.polygonPositions = [];
    this.stopDrawing();
  }

  private cancelLineDrawing() {
    if (!this.viewer) return;

    // Remove polyline collection from primitives
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.mainPolyline = null;
      this.tempPreviewLine = null;
    }

    // Reset line state
    this.linePositions = [];

    // Call regular cancel
    this.cancelDrawing();
  }

  private cancelPolygonDrawing() {
    if (!this.viewer) return;

    // Remove polyline collection from primitives
    if (this.polygonPolylineCollection) {
      this.viewer.scene.primitives.remove(this.polygonPolylineCollection);
      this.polygonPolylineCollection = null;
      this.polygonOutline = null;
      this.polygonPreviewLine = null;
      this.polygonClosingLine = null;
    }

    // Reset polygon state
    this.polygonPositions = [];

    // Call regular cancel
    this.cancelDrawing();
  }

  private handleCircleClick(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer) return;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartesian = this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid);

    if (!cartesian) {
      console.warn('Could not pick position on globe');
      return;
    }

    if (!this.hasCircleCenter) {
      // First click: set center
      this.circleCenter = Cesium.Cartesian3.clone(cartesian);
      this.hasCircleCenter = true;
      this.createCirclePreview();
      this.setupCircleMoveHandler();
    } else {
      // Second click: finish circle
      this.finishCircle(cartesian);
    }
  }

  private createCirclePreview() {
    if (!this.viewer || !this.circleCenter) return;

    this.currentCircleRadius = 50; // Start with 50 meter radius for visibility

    // Use CallbackProperty for dynamic radius updates during mouse movement
    this.circlePreview = this.viewer.entities.add({
      position: this.circleCenter,
      ellipse: {
        semiMinorAxis: new Cesium.CallbackProperty(() => this.currentCircleRadius, false),
        semiMajorAxis: new Cesium.CallbackProperty(() => this.currentCircleRadius + 1, false),
        material: Cesium.Color.CYAN.withAlpha(0.3),
        outline: true,
        outlineColor: Cesium.Color.CYAN.withAlpha(0.5),
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    });
  }

  private setupCircleMoveHandler() {
    if (!this.viewer || !this.handler || !this.circlePreview) return;

    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
        if (!this.circleCenter || !this.circlePreview || !this.viewer) return;

        const ellipsoid = this.viewer.scene.globe.ellipsoid;
        const cartesian = this.viewer.camera.pickEllipsoid(movement.endPosition, ellipsoid);

        if (Cesium.defined(cartesian)) {
          // Calculate geodesic distance
          const centerCarto = ellipsoid.cartesianToCartographic(this.circleCenter);
          const edgeCarto = ellipsoid.cartesianToCartographic(cartesian);
          const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, edgeCarto);
          let radius = geodesic.surfaceDistance;

          // Enforce minimum visible radius for preview
          const minPreviewRadius = 50; // 50 meters minimum
          radius = Math.max(radius, minPreviewRadius);

          // Update the radius value - CallbackProperty will automatically pick up the change
          this.currentCircleRadius = radius;
        }
      },
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
  }

  private finishCircle(edgePosition: Cesium.Cartesian3) {
    if (!this.viewer || !this.circleCenter) {
      console.warn('Circle center not set');
      this.cancelCircleDrawing();
      return;
    }

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Calculate final radius
    const centerCarto = ellipsoid.cartesianToCartographic(this.circleCenter);
    const edgeCarto = ellipsoid.cartesianToCartographic(edgePosition);
    const geodesic = new Cesium.EllipsoidGeodesic(centerCarto, edgeCarto);
    const radius = geodesic.surfaceDistance;

    // Minimum radius check
    if (radius < 10) {
      console.warn('Circle too small, minimum radius is 10 meters');
      this.cancelCircleDrawing();
      return;
    }

    // Generate feature name
    const name = generateFeatureName('circle');

    // Remove preview
    if (this.circlePreview) {
      this.viewer.entities.remove(this.circlePreview);
      this.circlePreview = null;
    }

    // Create final circle entity
    const entity = this.viewer.entities.add({
      position: this.circleCenter,
      ellipse: {
        semiMinorAxis: radius,
        semiMajorAxis: radius + 1, // Fixed offset to ensure semiMajor > semiMinor
        material: Cesium.Color.CYAN.withAlpha(0.3),
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
      type: 'circle',
      name,
      entity,
      metadata: {
        center: centerCarto,
        radius: radius,
        edgePosition: edgeCarto,
        createdAt: new Date(),
      },
      insightsOpen: false,
      visible: true,
    };

    // Notify callback
    if (this.onPointCreatedCallback) {
      this.onPointCreatedCallback(feature);
    }

    // Reset circle state and stop drawing
    this.circleCenter = null;
    this.hasCircleCenter = false;
    this.stopDrawing();
  }

  private cancelCircleDrawing() {
    if (!this.viewer) return;

    // Remove preview circle
    if (this.circlePreview) {
      this.viewer.entities.remove(this.circlePreview);
      this.circlePreview = null;
    }

    // Reset circle state
    this.circleCenter = null;
    this.hasCircleCenter = false;

    // Call regular cancel
    this.cancelDrawing();
  }

  stopDrawing() {
    // Remove click handler
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }

    // Remove ESC key handler
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    // Re-enable mouse tracking
    pointValueService.enableMouseTracking();

    this.currentTool = null;
  }

  cancelDrawing() {
    // Clean up line drawing state
    if (this.viewer && this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection);
      this.polylineCollection = null;
      this.mainPolyline = null;
      this.tempPreviewLine = null;
    }
    this.linePositions = [];

    // Clean up polygon drawing state
    if (this.viewer && this.polygonPolylineCollection) {
      this.viewer.scene.primitives.remove(this.polygonPolylineCollection);
      this.polygonPolylineCollection = null;
      this.polygonOutline = null;
      this.polygonPreviewLine = null;
      this.polygonClosingLine = null;
    }
    this.polygonPositions = [];

    // Clean up circle drawing state
    if (this.viewer && this.circlePreview) {
      this.viewer.entities.remove(this.circlePreview);
      this.circlePreview = null;
    }
    this.circleCenter = null;
    this.hasCircleCenter = false;

    this.stopDrawing();

    // Notify cancellation
    if (this.onDrawingCancelledCallback) {
      this.onDrawingCancelledCallback();
    }
  }

  destroy() {
    this.cancelDrawing();
    this.onPointCreatedCallback = null;
    this.onDrawingCancelledCallback = null;
  }
}
