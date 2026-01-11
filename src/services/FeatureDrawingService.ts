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

  startDrawing(tool: string) {
    if (!this.viewer) {
      console.error('Viewer not available');
      return;
    }

    this.currentTool = tool;

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
    }
    // Future: handle other drawing tools
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
    };

    // Notify callback
    if (this.onPointCreatedCallback) {
      this.onPointCreatedCallback(feature);
    }

    // Auto-stop drawing after creating point
    this.stopDrawing();
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
