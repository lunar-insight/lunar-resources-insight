import * as Cesium from 'cesium';
import { pointValueService } from './PointValueService';
import { Feature } from 'components/navigation/FeaturesSection/types';
import { generateFeatureName } from 'utils/context/FeaturesContext';
import { LineVertexEditingService } from './LineVertexEditingService';
import { PointDrawingService } from './drawing/PointDrawingService';
import { LineDrawingService } from './drawing/LineDrawingService';
import { PolygonDrawingService } from './drawing/PolygonDrawingService';
import { CircleDrawingService } from './drawing/CircleDrawingService';

export class FeatureDrawingService {
  private viewer: Cesium.Viewer | null = null;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private currentTool: string | null = null;
  private onPointCreatedCallback: ((feature: Feature) => void) | null = null;
  private onDrawingCancelledCallback: (() => void) | null = null;
  private onFeatureUpdatedCallback: ((id: string, newPosition: Cesium.Cartographic) => void) | null = null;
  private draggedEntity: Cesium.Entity | null = null;
  private showFeatures: boolean = true;
  private showLabels: boolean = true;

  // Drawing services
  private pointDrawingService: PointDrawingService;
  private lineDrawingService: LineDrawingService;
  private polygonDrawingService: PolygonDrawingService;
  private circleDrawingService: CircleDrawingService;

  // Line vertex editing service
  private lineVertexEditingService: LineVertexEditingService;

  constructor() {
    this.pointDrawingService = new PointDrawingService();
    this.lineDrawingService = new LineDrawingService();
    this.polygonDrawingService = new PolygonDrawingService();
    this.circleDrawingService = new CircleDrawingService();
    this.lineVertexEditingService = new LineVertexEditingService();
  }

  setViewer(viewer: Cesium.Viewer | null) {
    const viewerChanged = this.viewer !== viewer;
    this.viewer = viewer;

    // Set viewer for drawing services
    this.pointDrawingService.setViewer(viewer);
    this.lineDrawingService.setViewer(viewer);
    this.polygonDrawingService.setViewer(viewer);
    this.circleDrawingService.setViewer(viewer);
    this.lineVertexEditingService.setViewer(viewer);

    if (viewerChanged) {
      this.setupInteractionHandler();
    }
  }

  setCallbacks(
    onPointCreated: (feature: Feature) => void,
    onDrawingCancelled: () => void,
    onFeatureUpdated?: (id: string, newPosition: Cesium.Cartographic) => void,
    onLineUpdated?: (id: string, positions: Cesium.Cartographic[]) => void
  ) {
    this.onPointCreatedCallback = onPointCreated;
    this.onDrawingCancelledCallback = onDrawingCancelled;

    // Set callbacks for drawing services
    this.pointDrawingService.setCallback(onPointCreated);
    this.lineDrawingService.setCallback(onPointCreated);
    this.polygonDrawingService.setCallback(onPointCreated);
    this.circleDrawingService.setCallback(onPointCreated);
    this.circleDrawingService.setDrawingFinishedCallback(() => this.stopDrawing());

    if (onFeatureUpdated) {
      this.onFeatureUpdatedCallback = onFeatureUpdated;
    }
    if (onLineUpdated) {
      this.lineVertexEditingService.setCallback(onLineUpdated);
    }
  }

  setVisibility(showFeatures: boolean, showLabels: boolean) {
    this.showFeatures = showFeatures;
    this.showLabels = showLabels;

    // Set visibility for drawing services
    this.pointDrawingService.setVisibility(showFeatures, showLabels);
    this.lineDrawingService.setVisibility(showFeatures, showLabels);
    this.polygonDrawingService.setVisibility(showFeatures, showLabels);
    this.circleDrawingService.setVisibility(showFeatures, showLabels);
    this.lineVertexEditingService.setVisibility(showFeatures);
  }

  removeLineVertexMarkers(lineId: string): void {
    this.lineVertexEditingService.removeLineVertexMarkers(lineId);
  }

  ensureVertexMarkersForLine(lineId: string): void {
    this.lineVertexEditingService.ensureVertexMarkersForLine(lineId);
  }

  updateLineVertexMarkersVisibility(lineId: string, visible: boolean): void {
    this.lineVertexEditingService.updateLineVertexMarkersVisibility(lineId, visible);
  }

  startDrawing(tool: string) {
    if (!this.viewer) {
      console.error('Viewer not available');
      return;
    }

    this.currentTool = tool;

    // Start circle drawing modes
    if (tool === 'circle') {
      this.circleDrawingService.startMode('center-radius');
    } else if (tool === 'two-point-circle') {
      this.circleDrawingService.startMode('two-point');
    } else if (tool === 'three-point-circle') {
      this.circleDrawingService.startMode('three-point');
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

    if (this.handler) {
      this.handler.destroy();
    }

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    this.handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
        this.handleClick(click.position);
      },
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );

    // Setup mouse move handler for line, polygon, and circle drawing
    if (this.currentTool === 'line' || this.currentTool === 'polygon' ||
        this.currentTool === 'circle' || this.currentTool === 'two-point-circle' ||
        this.currentTool === 'three-point-circle') {
      this.handler.setInputAction(
        (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
          if (this.currentTool === 'line') {
            this.lineDrawingService.handleMouseMove(movement.endPosition);
          } else if (this.currentTool === 'polygon') {
            this.polygonDrawingService.handleMouseMove(movement.endPosition);
          } else if (this.currentTool === 'circle' || this.currentTool === 'two-point-circle' ||
                     this.currentTool === 'three-point-circle') {
            this.circleDrawingService.handleMouseMove(movement.endPosition);
          }
        },
        Cesium.ScreenSpaceEventType.MOUSE_MOVE
      );

      // Setup right-click to finish
      this.handler.setInputAction(
        () => {
          if (this.currentTool === 'line') {
            this.lineDrawingService.handleRightClick();
            this.stopDrawing();
          } else if (this.currentTool === 'polygon') {
            this.polygonDrawingService.handleRightClick();
            this.stopDrawing();
          }
        },
        Cesium.ScreenSpaceEventType.RIGHT_CLICK
      );

      // Setup double-click to finish
      this.handler.setInputAction(
        () => {
          if (this.currentTool === 'line') {
            this.lineDrawingService.handleDoubleClick();
            this.stopDrawing();
          } else if (this.currentTool === 'polygon') {
            this.polygonDrawingService.handleDoubleClick();
            this.stopDrawing();
          }
        },
        Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK
      );
    }
  }

  private handleClick(screenPosition: Cesium.Cartesian2) {
    if (!this.viewer || !this.currentTool) return;

    if (this.currentTool === 'point') {
      this.pointDrawingService.handleClick(screenPosition);
      // Auto-stop drawing after creating point
      this.stopDrawing();
    } else if (this.currentTool === 'line') {
      this.lineDrawingService.handleClick(screenPosition);
    } else if (this.currentTool === 'polygon') {
      this.polygonDrawingService.handleClick(screenPosition);
    } else if (this.currentTool === 'circle' || this.currentTool === 'two-point-circle' ||
               this.currentTool === 'three-point-circle') {
      this.circleDrawingService.handleClick(screenPosition);
    }
  }

  // Interaction Handling
  private setupInteractionHandler() {
    if (!this.viewer) return;
    if (this.currentTool) return; // Don't setup if drawing

    if (this.handler) {
      this.handler.destroy();
    }

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);

    this.handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      this.handleLeftDown(click.position);
    }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

    this.handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      this.handleMouseMove(movement.endPosition);
      this.handleHover(movement.endPosition);
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    this.handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      this.handleLeftUp(click.position);
    }, Cesium.ScreenSpaceEventType.LEFT_UP);

    // Right-click handler
    this.handler.setInputAction((click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
      this.lineVertexEditingService.handleRightClick(click.position);
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  private handleLeftDown(position: Cesium.Cartesian2) {
    if (!this.viewer) return;

    // Delegate to vertex editing service first
    const handledByVertexEditing = this.lineVertexEditingService.handleLeftDown(position);
    if (handledByVertexEditing) {
      return;
    }

    const pickedObject = this.viewer.scene.pick(position);
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id as Cesium.Entity;

      // Check if entity is a point feature with a position
      if (entity.point && entity.position &&
          !entity.properties?.hasProperty('_isVertexMarker') &&
          !entity.properties?.hasProperty('_isHoverPreview')) {
        this.draggedEntity = entity;
        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
        this.viewer.scene.screenSpaceCameraController.enableInputs = false;
        return;
      }
    }
  }

  private handleMouseMove(position: Cesium.Cartesian2) {
    if (!this.viewer) return;

    // Delegate to vertex editing service for vertex dragging
    const handledByVertexEditing = this.lineVertexEditingService.handleMouseMove(position);
    if (handledByVertexEditing) {
      return;
    }

    // Handle point feature dragging
    if (!this.draggedEntity) return;

    const cartesian = this.pickGlobePosition(position);
    if (cartesian) {
      this.draggedEntity.position = new Cesium.ConstantPositionProperty(cartesian);
    }
  }

  private pickGlobePosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    if (!this.viewer) return null;

    // Try scene.pickPosition first (terrain-aware)
    const pickedPosition = this.viewer.scene.pickPosition(screenPosition);
    if (pickedPosition) {
      return pickedPosition;
    }

    // Fallback to ellipsoid
    return this.viewer.camera.pickEllipsoid(screenPosition, this.viewer.scene.globe.ellipsoid) ?? null;
  }

  private handleHover(position: Cesium.Cartesian2) {
    if (!this.viewer) return;

    // Delegate to vertex editing service first
    const vertexEditingResult = this.lineVertexEditingService.handleHover(position);
    if (vertexEditingResult.handled) {
      // Apply the cursor returned by the vertex editing service
      this.viewer.canvas.style.cursor = vertexEditingResult.cursor;
      return;
    }

    // Show grabbing cursor while dragging point features
    if (this.draggedEntity) {
      this.viewer.canvas.style.cursor = 'grabbing';
      return;
    }

    const pickedObject = this.viewer.scene.pick(position);
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id as Cesium.Entity;

      // Check if it's a draggable point feature
      if (entity.point && entity.position &&
          !entity.properties?.hasProperty('_isVertexMarker') &&
          !entity.properties?.hasProperty('_isHoverPreview')) {
        this.viewer.canvas.style.cursor = 'grab';
        return;
      }
    }

    // Default cursor
    this.viewer.canvas.style.cursor = 'default';
  }

  private handleLeftUp(position?: Cesium.Cartesian2) {
    if (!this.viewer) return;

    // Delegate to vertex editing service for vertex drag finish
    const handledByVertexEditing = this.lineVertexEditingService.handleLeftUp(position);
    if (handledByVertexEditing) {
      return;
    }

    // Handle point feature dragging finish
    if (this.draggedEntity) {
      const finalPosition = this.draggedEntity.position?.getValue(Cesium.JulianDate.now());

      if (finalPosition) {
        const ellipsoid = this.viewer.scene.globe.ellipsoid;
        const cartographic = ellipsoid.cartesianToCartographic(finalPosition);

        // Notify context of update
        if (this.onFeatureUpdatedCallback && this.draggedEntity.id) {
          this.onFeatureUpdatedCallback(this.draggedEntity.id, cartographic);
        }
      }

      this.draggedEntity = null;
      this.viewer.scene.screenSpaceCameraController.enableRotate = true;
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }
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

    this.setupInteractionHandler();
  }

  cancelDrawing() {
    // Clean up drawing services
    this.lineDrawingService.cancel();
    this.polygonDrawingService.cancel();
    this.circleDrawingService.cancel();

    this.stopDrawing();

    // Notify cancellation
    if (this.onDrawingCancelledCallback) {
      this.onDrawingCancelledCallback();
    }
  }

  destroy() {
    this.cancelDrawing();

    // Clean up drawing services
    this.pointDrawingService.destroy();
    this.lineDrawingService.destroy();
    this.polygonDrawingService.destroy();
    this.circleDrawingService.destroy();
    this.lineVertexEditingService.destroy();

    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }

    this.onPointCreatedCallback = null;
    this.onDrawingCancelledCallback = null;
    this.onFeatureUpdatedCallback = null;
  }
}
