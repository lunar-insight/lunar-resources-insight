import * as Cesium from 'cesium';
import { DrawingUtils } from './drawing/DrawingUtils';
import { DistanceMode } from 'utils/context/MeasurementContext';

// Drives the two-point line measurement tool. Placement (before both points
// exist) is handled through this service's own screen-space handler, which
// also reports the live terrain-picked cursor position via onHoverPosition
// so the caller can render a ghost marker at the spot a click would land.
// Once both points are committed, per-endpoint dragging is driven by the
// marker components, via previewDrag/commitDrag.
//
// The settled line renders one of two ways depending on distanceMode:
// - 'terrain': a Cesium.GroundPolylinePrimitive, draped against real terrain
//   via scene.groundPrimitives.
// - 'surface': a floating Cesium.PolylineCollection arc between the two
//   points, ignoring terrain, matching the geodesic distance shown for that
//   mode.
// GroundPolylinePrimitive geometry can't be mutated after creation, so any
// live movement (placement preview, endpoint drag) always renders through
// the floating line first, then gets replaced by a rebuilt
// GroundPolylinePrimitive once the position settles, if that's the active
// mode.
export class MeasurementLineService {
  private viewer: Cesium.Viewer | null = null;
  private handler: Cesium.ScreenSpaceEventHandler | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private previousCursor: string | null = null;
  private distanceMode: DistanceMode = 'surface';

  private committed: Cesium.Cartesian3[] = [];
  private floatingLineCollection: Cesium.PolylineCollection | null = null;
  private floatingLine: Cesium.Polyline | null = null;
  private groundPrimitive: Cesium.GroundPolylinePrimitive | null = null;

  private onPointsCommitted: ((points: Cesium.Cartographic[]) => void) | null = null;
  private onLiveDistance: ((meters: number) => void) | null = null;
  private onHoverPosition: ((cartesian: Cesium.Cartesian3 | null) => void) | null = null;

  setViewer(viewer: Cesium.Viewer | null): void {
    this.viewer = viewer;
  }

  setCallbacks(
    onPointsCommitted: (points: Cesium.Cartographic[]) => void,
    onLiveDistance: (meters: number) => void,
    onHoverPosition: (cartesian: Cesium.Cartesian3 | null) => void
  ): void {
    this.onPointsCommitted = onPointsCommitted;
    this.onLiveDistance = onLiveDistance;
    this.onHoverPosition = onHoverPosition;
  }

  // Switches how the settled (non-interactive) line renders. Rebuilds
  // immediately if a measurement is already in place.
  setDistanceMode(mode: DistanceMode): void {
    if (this.distanceMode === mode) return;
    this.distanceMode = mode;
    if (this.committed.length === 2) {
      this.renderSettledLine();
    }
  }

  start(): void {
    if (!this.viewer || this.handler) return;

    this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
    this.handler.setInputAction(
      (click: Cesium.ScreenSpaceEventHandler.PositionedEvent) => this.handleClick(click.position),
      Cesium.ScreenSpaceEventType.LEFT_CLICK
    );
    this.handler.setInputAction(
      (movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => this.handleMouseMove(movement.endPosition),
      Cesium.ScreenSpaceEventType.MOUSE_MOVE
    );
    this.handler.setInputAction(() => this.cancelCurrent(), Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.cancelCurrent();
    };
    window.addEventListener('keydown', this.keyHandler);

    this.previousCursor = this.viewer.canvas.style.cursor;
    this.viewer.canvas.style.cursor = 'crosshair';
  }

  stop(): void {
    if (this.handler) {
      this.handler.destroy();
      this.handler = null;
    }
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }
    if (this.viewer) {
      this.viewer.canvas.style.cursor = this.previousCursor ?? 'default';
    }
    this.previousCursor = null;
    this.clearAll();
    this.emitHover(null);
  }

  // Called by a marker while its point is being actively dragged.
  previewDrag(index: 0 | 1, liveCartesian: Cesium.Cartesian3): void {
    if (this.committed.length !== 2) return;

    this.removeGroundLine();
    const other = this.committed[index === 0 ? 1 : 0];
    const a = index === 0 ? liveCartesian : other;
    const b = index === 0 ? other : liveCartesian;
    this.updateFloatingLine(a, b);
    this.emitLiveDistance(a, b);
  }

  // Called once a marker drag ends, with the final terrain-picked position.
  commitDrag(index: 0 | 1, finalCartesian: Cesium.Cartesian3): void {
    if (this.committed.length !== 2) return;

    this.committed[index] = Cesium.Cartesian3.clone(finalCartesian);
    this.removeFloatingLine();
    this.renderSettledLine();
    this.notifyCommitted();
  }

  destroy(): void {
    this.stop();
    this.onPointsCommitted = null;
    this.onLiveDistance = null;
    this.onHoverPosition = null;
  }

  private handleClick(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    const cartesian = DrawingUtils.pickGlobePosition(this.viewer, screenPosition);
    if (!cartesian) return;

    // Measurements are capped at two points: once complete, a further click
    // starts a fresh measurement.
    if (this.committed.length >= 2) {
      this.clearAll();
    }

    if (this.committed.length === 1 && Cesium.Cartesian3.equals(this.committed[0], cartesian)) {
      return;
    }

    this.committed.push(Cesium.Cartesian3.clone(cartesian));
    this.removeFloatingLine();

    if (this.committed.length === 2) {
      this.renderSettledLine();
      this.emitHover(null);
    }

    this.notifyCommitted();
  }

  private handleMouseMove(screenPosition: Cesium.Cartesian2): void {
    if (!this.viewer) return;

    if (this.committed.length >= 2) {
      this.emitHover(null);
      return;
    }

    const cartesian = DrawingUtils.pickGlobePosition(this.viewer, screenPosition);
    this.emitHover(cartesian);

    if (this.committed.length === 1 && cartesian) {
      this.updateFloatingLine(this.committed[0], cartesian);
    }
  }

  private cancelCurrent(): void {
    this.clearAll();
    this.notifyCommitted();
  }

  // Renders the settled (non-dragging) line for the current mode: a
  // terrain-draped GroundPolylinePrimitive, or a floating arc that ignores
  // terrain, matching the 'terrain' vs 'surface' distance calculation.
  private renderSettledLine(): void {
    if (!this.viewer || this.committed.length !== 2) return;

    if (this.distanceMode === 'terrain') {
      this.removeFloatingLine();
      this.buildGroundLine();
    } else {
      this.removeGroundLine();
      this.updateFloatingLine(this.committed[0], this.committed[1]);
    }
  }

  private updateFloatingLine(a: Cesium.Cartesian3, b: Cesium.Cartesian3): void {
    if (!this.viewer) return;

    const arcPositions = (Cesium as any).PolylinePipeline.generateCartesianArc({ positions: [a, b] });

    if (!this.floatingLineCollection) {
      this.floatingLineCollection = new Cesium.PolylineCollection();
      this.viewer.scene.primitives.add(this.floatingLineCollection);
    }

    if (this.floatingLine) {
      this.floatingLine.positions = arcPositions;
    } else {
      this.floatingLine = this.floatingLineCollection.add({
        positions: arcPositions,
        width: 3,
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: new Cesium.Color(0, 1, 1, 0.6),
        }),
      });
    }
  }

  private removeFloatingLine(): void {
    if (this.floatingLineCollection && this.viewer) {
      this.viewer.scene.primitives.remove(this.floatingLineCollection);
    }
    this.floatingLineCollection = null;
    this.floatingLine = null;
  }

  private buildGroundLine(): void {
    if (!this.viewer || this.committed.length !== 2) return;

    this.removeGroundLine();

    if (!Cesium.GroundPolylinePrimitive.isSupported(this.viewer.scene)) {
      console.warn('GroundPolylinePrimitive is not supported on this device, showing an undraped line instead.');
      this.updateFloatingLine(this.committed[0], this.committed[1]);
      return;
    }

    this.groundPrimitive = new Cesium.GroundPolylinePrimitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.GroundPolylineGeometry({
          positions: [this.committed[0], this.committed[1]],
          width: 3,
        }),
      }),
      appearance: new Cesium.PolylineMaterialAppearance({
        material: Cesium.Material.fromType(Cesium.Material.ColorType, {
          color: Cesium.Color.CYAN,
        }),
      }),
    });
    this.viewer.scene.groundPrimitives.add(this.groundPrimitive);
  }

  private removeGroundLine(): void {
    if (this.groundPrimitive && this.viewer) {
      this.viewer.scene.groundPrimitives.remove(this.groundPrimitive);
    }
    this.groundPrimitive = null;
  }

  private clearAll(): void {
    this.committed = [];
    this.removeFloatingLine();
    this.removeGroundLine();
  }

  private notifyCommitted(): void {
    if (!this.viewer || !this.onPointsCommitted) return;
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    this.onPointsCommitted(this.committed.map((c) => ellipsoid.cartesianToCartographic(c)));
  }

  private emitLiveDistance(a: Cesium.Cartesian3, b: Cesium.Cartesian3): void {
    if (!this.viewer || !this.onLiveDistance) return;
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const geodesic = new Cesium.EllipsoidGeodesic(
      ellipsoid.cartesianToCartographic(a),
      ellipsoid.cartesianToCartographic(b)
    );
    this.onLiveDistance(geodesic.surfaceDistance);
  }

  private emitHover(cartesian: Cesium.Cartesian3 | null): void {
    this.onHoverPosition?.(cartesian);
  }
}
