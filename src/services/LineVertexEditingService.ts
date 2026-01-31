import * as Cesium from 'cesium';

/**
 * Service responsible for managing line vertex editing functionality.
 * Handles vertex markers, dragging, insertion, deletion, and hover previews.
 */
export class LineVertexEditingService {
  // Interaction sensitivity thresholds (in pixels)
  // Adjustment of values to change "magnet" sensitivity:
  // - Lower values = more precision required (less magnetic)
  // - Higher values = easier to grab (more magnetic)
  // VERTEX_SNAP_THRESHOLD should always be ≤ LINE_SEGMENT_THRESHOLD
  private readonly VERTEX_SNAP_THRESHOLD = 5; // Distance to snap to existing vertices
  private readonly LINE_SEGMENT_THRESHOLD = 10; // Distance to detect line segments for insertion

  private viewer: Cesium.Viewer | null = null;
  private showFeatures: boolean = true;

  // Line vertex editing state
  private lineVertexMarkers: Map<string, Cesium.Entity[]> = new Map();
  private draggedVertexInfo: { lineId: string; vertexIndex: number } | null = null;
  private isDraggingVertex: boolean = false;
  private hasStartedDragPreview: boolean = false;
  private onLineUpdatedCallback: ((id: string, positions: Cesium.Cartographic[]) => void) | null = null;
  private hoverPreviewVertex: Cesium.Entity | null = null;
  private vertexDragPolylineCollection: Cesium.PolylineCollection | null = null;
  private vertexDragPreviewLine: Cesium.Polyline | null = null;
  private originalLineVisibility: boolean = true;

  setViewer(viewer: Cesium.Viewer | null) {
    this.viewer = viewer;
  }

  setCallback(onLineUpdated: (id: string, positions: Cesium.Cartographic[]) => void) {
    this.onLineUpdatedCallback = onLineUpdated;
  }

  setVisibility(showFeatures: boolean) {
    this.showFeatures = showFeatures;

    // Update visibility for all existing vertex markers
    this.updateAllVertexMarkersVisibility();
  }

  /**
   * Updates the visibility of vertex markers for a specific line.
   * @param lineId - The ID of the line feature
   * @param visible - Whether the vertex markers should be visible
   */
  updateLineVertexMarkersVisibility(lineId: string, visible: boolean): void {
    const markers = this.lineVertexMarkers.get(lineId);
    if (!markers) return;

    // Update visibility for all markers of this line
    // Vertex markers are visible only if:
    // 1. Global showFeatures is true, AND
    // 2. The specific line is visible
    const shouldShow = this.showFeatures && visible;

    markers.forEach(marker => {
      if (marker.point) {
        marker.point.show = new Cesium.ConstantProperty(shouldShow);
      }
    });
  }

  /**
   * Updates the color of vertex markers for a specific line.
   * @param lineId - The ID of the line feature
   * @param color - Cesium Color object to apply to the markers
   */
  updateLineVertexMarkersColor(lineId: string, color: Cesium.Color): void {
    const markers = this.lineVertexMarkers.get(lineId);
    if (!markers) return;

    markers.forEach(marker => {
      if (marker.point) {
        // Update the outline color to match the line color
        marker.point.outlineColor = new Cesium.ConstantProperty(color);
      }
    });
  }

  /**
   * Updates visibility for all vertex markers based on global visibility settings.
   * This is called when global visibility changes.
   */
  private updateAllVertexMarkersVisibility(): void {
    if (!this.viewer) return;

    // Update all vertex markers to respect global visibility
    for (const [lineId, markers] of this.lineVertexMarkers.entries()) {
      // Get the line entity to check its visibility
      const lineEntity = this.viewer.entities.getById(lineId);
      if (!lineEntity || !lineEntity.polyline) continue;

      // Check if the line itself is visible
      const lineShowProperty = lineEntity.polyline.show;
      const lineVisible = lineShowProperty
        ? (lineShowProperty.getValue(Cesium.JulianDate.now()) ?? true)
        : true;

      // Update markers: visible only if both global and line-specific visibility are true
      const shouldShow = this.showFeatures && lineVisible;
      markers.forEach(marker => {
        if (marker.point) {
          marker.point.show = new Cesium.ConstantProperty(shouldShow);
        }
      });
    }
  }

  /**
   * Picks a position on the globe from screen coordinates.
   * Uses scene.pickPosition() first (which picks actual rendered terrain), then falls back to
   * camera.pickEllipsoid() if terrain picking fails.
   */
  private pickGlobePosition(screenPosition: Cesium.Cartesian2): Cesium.Cartesian3 | null {
    if (!this.viewer) return null;

    // Try to pick the actual rendered surface first (includes terrain)
    const terrainPosition = this.viewer.scene.pickPosition(screenPosition);
    if (terrainPosition) {
      return terrainPosition;
    }

    // Fall back to ellipsoid surface if terrain picking fails
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    return this.viewer.camera.pickEllipsoid(screenPosition, ellipsoid) || null;
  }

  private createVertexMarkersForLine(lineId: string, positions: Cesium.Cartesian3[]): void {
    if (!this.viewer) return;

    // Remove existing markers for this line
    this.removeVertexMarkersForLine(lineId);

    const markers: Cesium.Entity[] = [];

    positions.forEach((position, index) => {
      const marker = this.viewer!.entities.add({
        position: position,
        point: {
          pixelSize: 8,
          color: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.CYAN,
          outlineWidth: 2,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          show: this.showFeatures,
        },
        properties: new Cesium.PropertyBag({
          _vertexInfo: { lineId, vertexIndex: index },
          _isVertexMarker: true,
        }),
      });
      markers.push(marker);
    });

    this.lineVertexMarkers.set(lineId, markers);
  }

  private removeVertexMarkersForLine(lineId: string): void {
    const markers = this.lineVertexMarkers.get(lineId);
    if (markers && this.viewer) {
      markers.forEach(marker => this.viewer!.entities.remove(marker));
    }
    this.lineVertexMarkers.delete(lineId);
  }

  removeLineVertexMarkers(lineId: string): void {
    this.removeVertexMarkersForLine(lineId);
  }

  /**
   * Ensures vertex markers exist for a line feature.
   * Call this for existing/loaded lines that need editing capability.
   */
  ensureVertexMarkersForLine(lineId: string): void {
    if (!this.viewer) return;

    // Check if markers exist and are still valid in the viewer
    if (this.lineVertexMarkers.has(lineId)) {
      const existingMarkers = this.lineVertexMarkers.get(lineId)!;
      // Verify all markers still exist in the viewer
      const allMarkersValid = existingMarkers.length > 0 &&
        existingMarkers.every(marker => this.viewer!.entities.contains(marker));

      if (allMarkersValid) {
        return; // Markers exist and are valid
      }

      // Markers are stale (removed from viewer), clean up the map entry
      this.lineVertexMarkers.delete(lineId);
    }

    // Find the line entity
    const lineEntity = this.viewer.entities.getById(lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    // Get positions from the polyline
    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    if (!positions || positions.length < 2) return;

    // Create vertex markers
    this.createVertexMarkersForLine(lineId, positions);
  }

  /**
   * Start the real-time preview polyline for vertex dragging.
   * This creates a temporary polyline primitive that updates smoothly during dragging.
   */
  private startVertexDragPreview(lineId: string): void {
    if (!this.viewer) return;

    const lineEntity = this.viewer.entities.getById(lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    // Store original visibility
    const visibilityProperty = lineEntity.polyline.show;
    if (visibilityProperty) {
      this.originalLineVisibility = visibilityProperty.getValue(Cesium.JulianDate.now()) ?? true;
    }

    // Hide the original line entity during dragging
    lineEntity.polyline.show = new Cesium.ConstantProperty(false);

    // Get current positions
    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    if (!positions || positions.length < 2) return;

    // Create polyline collection for real-time preview
    this.vertexDragPolylineCollection = new Cesium.PolylineCollection();
    this.vertexDragPreviewLine = this.vertexDragPolylineCollection.add({
      positions: (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: positions,
      }),
      width: 3,
      material: Cesium.Material.fromType(Cesium.Material.ColorType, {
        color: new Cesium.Color(0, 1, 1, 1.0), // Solid cyan
      }),
    });
    this.viewer.scene.primitives.add(this.vertexDragPolylineCollection);
  }

  private updateVertexPosition(lineId: string, vertexIndex: number, newPosition: Cesium.Cartesian3): void {
    if (!this.viewer) return;

    // Find the line entity
    const lineEntity = this.viewer.entities.getById(lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    // Get current positions
    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const currentPositions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    if (!currentPositions || vertexIndex >= currentPositions.length) return;

    // Update the position in place for better performance
    currentPositions[vertexIndex] = Cesium.Cartesian3.clone(newPosition);

    // Update the real-time preview polyline (primitive) for smooth rendering
    if (this.vertexDragPreviewLine) {
      this.vertexDragPreviewLine.positions = (Cesium as any).PolylinePipeline.generateCartesianArc({
        positions: currentPositions,
      });
    }

    // Also update the entity positions (for when drag finishes)
    lineEntity.polyline.positions = new Cesium.ConstantProperty([...currentPositions]);

    // Update vertex marker position
    const markers = this.lineVertexMarkers.get(lineId);
    if (markers && markers[vertexIndex]) {
      markers[vertexIndex].position = new Cesium.ConstantPositionProperty(newPosition);
    }
  }

  private finishVertexDrag(): void {
    if (!this.viewer || !this.draggedVertexInfo) return;

    const lineEntity = this.viewer.entities.getById(this.draggedVertexInfo.lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    // Clean up the preview polyline primitive
    if (this.vertexDragPolylineCollection) {
      this.viewer.scene.primitives.remove(this.vertexDragPolylineCollection);
      this.vertexDragPolylineCollection = null;
      this.vertexDragPreviewLine = null;
    }

    // Restore the original line visibility
    lineEntity.polyline.show = new Cesium.ConstantProperty(this.originalLineVisibility);

    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert to cartographic for callback
    const cartographicPositions = positions.map(pos =>
      ellipsoid.cartesianToCartographic(pos)
    );

    // Notify context of line update
    if (this.onLineUpdatedCallback) {
      this.onLineUpdatedCallback(this.draggedVertexInfo.lineId, cartographicPositions);
    }
  }

  /**
   * Calculate the distance from a point to a line segment in screen space (pixels).
   * Uses 2D screen coordinates for consistent interaction regardless of camera altitude.
   */
  private pointToScreenSegmentDistance(
    point: Cesium.Cartesian2,
    segmentStart: Cesium.Cartesian2,
    segmentEnd: Cesium.Cartesian2
  ): number {
    // Calculate segment vector
    const segmentVector = new Cesium.Cartesian2(
      segmentEnd.x - segmentStart.x,
      segmentEnd.y - segmentStart.y
    );

    // Calculate point vector from segment start
    const pointVector = new Cesium.Cartesian2(
      point.x - segmentStart.x,
      point.y - segmentStart.y
    );

    // Calculate segment length squared
    const segmentLengthSq = segmentVector.x * segmentVector.x + segmentVector.y * segmentVector.y;

    // If segment has zero length, return distance to start point
    if (segmentLengthSq === 0) {
      return Math.sqrt(pointVector.x * pointVector.x + pointVector.y * pointVector.y);
    }

    // Calculate projection parameter (clamped to [0,1])
    const dot = pointVector.x * segmentVector.x + pointVector.y * segmentVector.y;
    let t = dot / segmentLengthSq;
    t = Math.max(0, Math.min(1, t));

    // Calculate closest point on segment
    const projectionX = segmentStart.x + t * segmentVector.x;
    const projectionY = segmentStart.y + t * segmentVector.y;

    // Calculate distance from point to projection
    const dx = point.x - projectionX;
    const dy = point.y - projectionY;

    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate the distance from a screen point to a terrain-draped line segment in screen space (pixels).
   * This accounts for the curvature of terrain-draped lines by sampling points along the geodesic arc.
   * Provides accurate distance measurements for lines with clampToGround enabled.
   */
  private pointToTerrainDrapedLineDistance(
    screenPoint: Cesium.Cartesian2,
    segmentStart: Cesium.Cartesian3,
    segmentEnd: Cesium.Cartesian3
  ): number {
    if (!this.viewer) return Number.POSITIVE_INFINITY;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const scene = this.viewer.scene;

    // Convert segment endpoints to cartographic
    const startCarto = ellipsoid.cartesianToCartographic(segmentStart);
    const endCarto = ellipsoid.cartesianToCartographic(segmentEnd);

    // Use geodesic to sample points along the arc
    const geodesic = new Cesium.EllipsoidGeodesic(startCarto, endCarto);

    // Use fixed conservative sample count for performance
    // The ternary search in getClosestPointOnGeodesicSegment handles precision,
    // so we just need enough samples to detect proximity to the line
    const numSamples = 30; // Fixed count optimized for performance

    let minDistance = Number.POSITIVE_INFINITY;

    // Sample points along the geodesic and find minimum screen-space distance
    for (let i = 0; i < numSamples; i++) {
      const t1 = i / numSamples;
      const t2 = (i + 1) / numSamples;

      // Get two consecutive points along the geodesic
      const fraction1 = geodesic.surfaceDistance * t1;
      const fraction2 = geodesic.surfaceDistance * t2;

      const carto1 = geodesic.interpolateUsingSurfaceDistance(fraction1);
      const carto2 = geodesic.interpolateUsingSurfaceDistance(fraction2);

      // Skip terrain height lookups for distance detection - they're expensive
      // and not critical since the ternary search handles precise positioning
      // The slight inaccuracy in distance detection is acceptable for the performance gain

      // Convert to cartesian
      const pos1 = ellipsoid.cartographicToCartesian(carto1);
      const pos2 = ellipsoid.cartographicToCartesian(carto2);

      // Convert to screen coordinates
      const screen1 = scene.cartesianToCanvasCoordinates(pos1);
      const screen2 = scene.cartesianToCanvasCoordinates(pos2);

      // Skip if either point is not visible on screen
      if (!screen1 || !screen2) continue;

      // Calculate distance from screen point to this screen-space segment
      const distance = this.pointToScreenSegmentDistance(screenPoint, screen1, screen2);

      minDistance = Math.min(minDistance, distance);
    }

    return minDistance;
  }

  private isNearLineSegment(screenPosition: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const pixelThreshold = this.LINE_SEGMENT_THRESHOLD;

    // Check all line features
    for (const entity of this.viewer.entities.values) {
      if (!entity.polyline) continue;

      const positionsProperty = entity.polyline.positions;
      if (!positionsProperty) continue;

      const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
      if (!positions || positions.length < 2) continue;

      // Check each segment using terrain-draped distance calculation
      for (let i = 0; i < positions.length - 1; i++) {
        const segmentStart = positions[i];
        const segmentEnd = positions[i + 1];

        // Calculate terrain-aware screen-space distance from mouse to line segment
        const distance = this.pointToTerrainDrapedLineDistance(
          screenPosition,
          segmentStart,
          segmentEnd
        );

        if (distance < pixelThreshold) {
          return true; // Mouse is near a line segment
        }
      }
    }

    return false; // Not near any line segment
  }

  /**
   * Check if the mouse is near any vertex marker.
   * Returns true if within pixel threshold of any vertex marker.
   */
  private isNearVertexMarker(screenPosition: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const pixelThreshold = this.VERTEX_SNAP_THRESHOLD;

    // Check all vertex markers
    for (const markers of this.lineVertexMarkers.values()) {
      for (const marker of markers) {
        if (!marker.position) continue;

        const markerPosition = marker.position.getValue(Cesium.JulianDate.now());
        if (!markerPosition) continue;

        // Convert marker position to screen coordinates
        const screenMarkerPos = this.viewer.scene.cartesianToCanvasCoordinates(markerPosition);
        if (!screenMarkerPos) continue;

        // Calculate screen-space distance from mouse to marker
        const dx = screenPosition.x - screenMarkerPos.x;
        const dy = screenPosition.y - screenMarkerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < pixelThreshold) {
          return true; // Mouse is near this vertex marker
        }
      }
    }

    return false; // Not near any vertex marker
  }

  /**
   * Find the nearest vertex marker within the pixel threshold.
   * Returns the vertex info if found, null otherwise.
   */
  private findNearestVertexMarker(screenPosition: Cesium.Cartesian2): {
    lineId: string;
    vertexIndex: number;
  } | null {
    if (!this.viewer) return null;

    const pixelThreshold = this.VERTEX_SNAP_THRESHOLD;
    let closestDistance = pixelThreshold;
    let closestVertexInfo: { lineId: string; vertexIndex: number } | null = null;

    // Check all vertex markers
    for (const [lineId, markers] of this.lineVertexMarkers.entries()) {
      for (let i = 0; i < markers.length; i++) {
        const marker = markers[i];
        if (!marker.position) continue;

        const markerPosition = marker.position.getValue(Cesium.JulianDate.now());
        if (!markerPosition) continue;

        // Convert marker position to screen coordinates
        const screenMarkerPos = this.viewer.scene.cartesianToCanvasCoordinates(markerPosition);
        if (!screenMarkerPos) continue;

        // Calculate screen-space distance from mouse to marker
        const dx = screenPosition.x - screenMarkerPos.x;
        const dy = screenPosition.y - screenMarkerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Track the closest vertex marker
        if (distance < closestDistance) {
          closestDistance = distance;
          closestVertexInfo = {
            lineId,
            vertexIndex: i
          };
        }
      }
    }

    return closestVertexInfo;
  }

  /**
   * Check if hovering near a line segment and return preview vertex position.
   */
  private checkLineSegmentHover(screenPosition: Cesium.Cartesian2): { position: Cesium.Cartesian3 } | null {
    if (!this.viewer) return null;

    // IMPORTANT: First check if we're near a vertex marker
    // This prevents the crosshair cursor from appearing when hovering near vertices
    const vertexExclusionThreshold = this.VERTEX_SNAP_THRESHOLD;

    // Check all vertex markers
    for (const markers of this.lineVertexMarkers.values()) {
      for (const marker of markers) {
        if (!marker.position) continue;

        const markerPosition = marker.position.getValue(Cesium.JulianDate.now());
        if (!markerPosition) continue;

        // Convert marker position to screen coordinates
        const screenMarkerPos = this.viewer.scene.cartesianToCanvasCoordinates(markerPosition);
        if (!screenMarkerPos) continue;

        // Calculate screen-space distance from mouse to marker
        const dx = screenPosition.x - screenMarkerPos.x;
        const dy = screenPosition.y - screenMarkerPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If near a vertex marker, don't show line segment hover
        if (distance < vertexExclusionThreshold) {
          return null; // Too close to a vertex - let vertex grab cursor take precedence
        }
      }
    }

    const pixelThreshold = this.LINE_SEGMENT_THRESHOLD;
    let closestDistance = pixelThreshold;
    let closestSegmentInfo: { start: Cesium.Cartesian3; end: Cesium.Cartesian3 } | null = null;

    // Check all line features
    for (const entity of this.viewer.entities.values) {
      if (!entity.polyline) continue;

      const positionsProperty = entity.polyline.positions;
      if (!positionsProperty) continue;

      const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
      if (!positions || positions.length < 2) continue;

      // Check each segment using terrain-draped distance calculation
      for (let i = 0; i < positions.length - 1; i++) {
        const segmentStart = positions[i];
        const segmentEnd = positions[i + 1];

        // Calculate terrain-aware screen-space distance from mouse to line segment
        const distance = this.pointToTerrainDrapedLineDistance(
          screenPosition,
          segmentStart,
          segmentEnd
        );

        // Track the closest segment
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSegmentInfo = { start: segmentStart, end: segmentEnd };
        }
      }
    }

    if (closestSegmentInfo) {
      // Use the mouse position picked on the globe for more accurate positioning
      const mousePosition = this.pickGlobePosition(screenPosition);

      if (mousePosition) {
        // Find the closest point on the geodesic arc to the mouse position
        const closestPosition = this.getClosestPointOnGeodesicSegment(
          mousePosition,
          closestSegmentInfo.start,
          closestSegmentInfo.end
        );
        return { position: closestPosition };
      }
    }

    return null; // Not near any line segment
  }

  /**
   * Find the closest point on a geodesic segment to a given position.
   * Uses ternary search algorithm to find the exact closest point continuously along the geodesic arc.
   * This provides smooth, continuous positioning without discrete snapping to fixed sample points.
   */
  private getClosestPointOnGeodesicSegment(
    targetPosition: Cesium.Cartesian3,
    segmentStart: Cesium.Cartesian3,
    segmentEnd: Cesium.Cartesian3
  ): Cesium.Cartesian3 {
    if (!this.viewer) return segmentStart;

    const ellipsoid = this.viewer.scene.globe.ellipsoid;

    // Convert segment endpoints to cartographic
    const startCarto = ellipsoid.cartesianToCartographic(segmentStart);
    const endCarto = ellipsoid.cartesianToCartographic(segmentEnd);
    const targetCarto = ellipsoid.cartesianToCartographic(targetPosition);

    // Use geodesic to interpolate along the arc
    const geodesic = new Cesium.EllipsoidGeodesic(startCarto, endCarto);

    // Use fixed conservative epsilon for performance
    // 1e-5 provides smooth positioning without excessive iterations
    // (typically 8-10 iterations vs 12-15 for adaptive approach)
    const epsilon = 1e-5;

    // Helper function to calculate distance at a given parameter t (0 to 1)
    const distanceAtT = (t: number): number => {
      const fraction = geodesic.surfaceDistance * t;
      const sampledCarto = geodesic.interpolateUsingSurfaceDistance(fraction);
      const sampledGeodesic = new Cesium.EllipsoidGeodesic(targetCarto, sampledCarto);
      return sampledGeodesic.surfaceDistance;
    };

    // Use ternary search to find the closest point continuously along the geodesic
    // This provides smooth positioning without discrete snapping
    let left = 0;
    let right = 1;

    while (right - left > epsilon) {
      const leftThird = left + (right - left) / 3;
      const rightThird = right - (right - left) / 3;

      const distLeft = distanceAtT(leftThird);
      const distRight = distanceAtT(rightThird);

      if (distLeft > distRight) {
        // Minimum is in the right two-thirds
        left = leftThird;
      } else {
        // Minimum is in the left two-thirds
        right = rightThird;
      }
    }

    // Use the midpoint of the final interval as the best parameter
    const bestT = (left + right) / 2;

    // Calculate final position using smooth geodesic interpolation
    // Note: We don't apply terrain height here to avoid visible stepping from terrain grid quantization
    // The terrain-aware distance calculation ensures we're near the line, and actual vertex placement
    // will use clampToGround when created
    const finalFraction = geodesic.surfaceDistance * bestT;
    const finalCarto = geodesic.interpolateUsingSurfaceDistance(finalFraction);
    const finalPosition = ellipsoid.cartographicToCartesian(finalCarto);

    return finalPosition;
  }

  /**
   * Show or update the hover preview vertex at the specified position.
   */
  private showHoverPreviewVertex(position: Cesium.Cartesian3): void {
    if (!this.viewer) return;

    // Update existing preview vertex position
    if (this.hoverPreviewVertex) {
      this.hoverPreviewVertex.position = new Cesium.ConstantPositionProperty(position);
      return;
    }

    // Create new preview vertex
    this.hoverPreviewVertex = this.viewer.entities.add({
      position: position,
      point: {
        pixelSize: 8,
        color: Cesium.Color.WHITE.withAlpha(0.5), // Semi-transparent white
        outlineColor: Cesium.Color.CYAN.withAlpha(0.7), // Semi-transparent cyan outline
        outlineWidth: 2,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      properties: new Cesium.PropertyBag({
        _isHoverPreview: true,
      }),
    });
  }

  /**
   * Remove the hover preview vertex if it exists.
   */
  private removeHoverPreviewVertex(): void {
    if (this.hoverPreviewVertex && this.viewer) {
      this.viewer.entities.remove(this.hoverPreviewVertex);
      this.hoverPreviewVertex = null;
    }
  }

  private checkLineSegmentClick(screenPosition: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const pixelThreshold = this.LINE_SEGMENT_THRESHOLD;
    let closestDistance = pixelThreshold;
    let closestSegmentInfo: {
      entityId: string;
      segmentIndex: number;
      start: Cesium.Cartesian3;
      end: Cesium.Cartesian3
    } | null = null;

    // Iterate through all line features to find the closest segment
    for (const entity of this.viewer.entities.values) {
      if (!entity.polyline) continue;

      const positionsProperty = entity.polyline.positions;
      if (!positionsProperty) continue;

      const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];
      if (!positions || positions.length < 2) continue;

      // Check each segment using terrain-draped distance calculation
      for (let i = 0; i < positions.length - 1; i++) {
        const segmentStart = positions[i];
        const segmentEnd = positions[i + 1];

        // Calculate terrain-aware screen-space distance from click to line segment
        const distance = this.pointToTerrainDrapedLineDistance(
          screenPosition,
          segmentStart,
          segmentEnd
        );

        // Track the closest segment
        if (distance < closestDistance) {
          closestDistance = distance;
          closestSegmentInfo = {
            entityId: entity.id,
            segmentIndex: i,
            start: segmentStart,
            end: segmentEnd
          };
        }
      }
    }

    // If a close segment was found, calculate the accurate insertion position
    if (closestSegmentInfo) {
      // Try to get the click position on the globe (terrain-aware)
      const clickPosition = this.pickGlobePosition(screenPosition);

      // Calculate the closest point on the geodesic segment
      // This ensures accurate positioning even when clicking directly on the line
      const insertPosition = clickPosition
        ? this.getClosestPointOnGeodesicSegment(
            clickPosition,
            closestSegmentInfo.start,
            closestSegmentInfo.end
          )
        : this.getClosestPointOnGeodesicSegment(
            closestSegmentInfo.start, // Fallback: use segment start
            closestSegmentInfo.start,
            closestSegmentInfo.end
          );

      // Found a segment - start vertex insertion drag
      this.startVertexInsertion(
        closestSegmentInfo.entityId,
        closestSegmentInfo.segmentIndex,
        insertPosition
      );
      return true;
    }

    return false; // No segment found
  }

  private startVertexInsertion(lineId: string, segmentIndex: number, position: Cesium.Cartesian3): void {
    if (!this.viewer) return;

    const lineEntity = this.viewer.entities.getById(lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];

    // Insert new vertex after segmentIndex
    const newPositions = [
      ...positions.slice(0, segmentIndex + 1),
      Cesium.Cartesian3.clone(position),
      ...positions.slice(segmentIndex + 1)
    ];

    // Update line entity
    lineEntity.polyline.positions = new Cesium.ConstantProperty(newPositions);

    // Recreate vertex markers with new count
    this.createVertexMarkersForLine(lineId, newPositions);

    // Start dragging the new vertex
    this.draggedVertexInfo = { lineId, vertexIndex: segmentIndex + 1 };
    this.isDraggingVertex = true;
    this.hasStartedDragPreview = false; // Preview will start on first mouse move
    this.viewer.scene.screenSpaceCameraController.enableInputs = false;
  }

  private deleteVertex(lineId: string, vertexIndex: number): void {
    if (!this.viewer) return;

    const lineEntity = this.viewer.entities.getById(lineId);
    if (!lineEntity || !lineEntity.polyline) return;

    const positionsProperty = lineEntity.polyline.positions;
    if (!positionsProperty) return;

    const positions = positionsProperty.getValue(Cesium.JulianDate.now()) as Cesium.Cartesian3[];

    // Enforce minimum 2 vertices
    if (positions.length <= 2) {
      console.warn('Cannot delete vertex: line must have at least 2 vertices');
      return;
    }

    // Remove the vertex
    const newPositions = [
      ...positions.slice(0, vertexIndex),
      ...positions.slice(vertexIndex + 1)
    ];

    // Update line entity
    lineEntity.polyline.positions = new Cesium.ConstantProperty(newPositions);

    // Recreate vertex markers
    this.createVertexMarkersForLine(lineId, newPositions);

    // Notify context of update
    const ellipsoid = this.viewer.scene.globe.ellipsoid;
    const cartographicPositions = newPositions.map(pos =>
      ellipsoid.cartesianToCartographic(pos)
    );

    if (this.onLineUpdatedCallback) {
      this.onLineUpdatedCallback(lineId, cartographicPositions);
    }
  }

  // ===== Public Handler Methods (called from FeatureDrawingService) =====

  handleLeftDown(position: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    // Priority 1: Check if clicking near a vertex marker (within threshold)
    // This ensures that when the "grab" cursor appears, clicking will actually drag the vertex
    const nearestVertex = this.findNearestVertexMarker(position);
    if (nearestVertex) {
      this.draggedVertexInfo = nearestVertex;
      this.isDraggingVertex = true;
      this.hasStartedDragPreview = false; // Preview will start on first mouse move
      this.viewer.scene.screenSpaceCameraController.enableInputs = false;
      return true;
    }

    const pickedObject = this.viewer.scene.pick(position);
    if (Cesium.defined(pickedObject) && pickedObject.id instanceof Cesium.Entity) {
      const entity = pickedObject.id as Cesium.Entity;

      // Check if it's a vertex marker (direct pick - fallback if proximity check missed)
      if (entity.properties && entity.properties.hasProperty('_isVertexMarker')) {
        const isVertexMarker = entity.properties.getValue(Cesium.JulianDate.now())._isVertexMarker;
        if (isVertexMarker) {
          const vertexInfo = entity.properties.getValue(Cesium.JulianDate.now())._vertexInfo;
          this.draggedVertexInfo = vertexInfo;
          this.isDraggingVertex = true;
          this.hasStartedDragPreview = false; // Preview will start on first mouse move
          this.viewer.scene.screenSpaceCameraController.enableInputs = false;
          return true;
        }
      }

      // Check if entity is a polyline (line feature) for vertex insertion
      if (entity.polyline) {
        // Disable camera immediately to prevent camera movement
        this.viewer.scene.screenSpaceCameraController.enableInputs = false;

        // Try to find and insert vertex on the line segment
        const foundSegment = this.checkLineSegmentClick(position);

        // Re-enable camera if no segment was found
        if (!foundSegment) {
          this.viewer.scene.screenSpaceCameraController.enableInputs = true;
        }
        return foundSegment;
      }

      // If entity doesn't match any known type (e.g., hover preview vertex),
      // treat it as a potential line segment click for vertex insertion
      return this.checkLineSegmentClick(position);
    } else {
      // No entity picked - check for click on line segment (for vertex insertion)
      return this.checkLineSegmentClick(position);
    }
  }

  handleMouseMove(position: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const cartesian = this.pickGlobePosition(position);

    // Handle vertex dragging
    if (this.isDraggingVertex && this.draggedVertexInfo && cartesian) {
      // Start the preview on first mouse movement (lazy initialization)
      if (!this.hasStartedDragPreview) {
        this.startVertexDragPreview(this.draggedVertexInfo.lineId);
        this.hasStartedDragPreview = true;
      }

      this.updateVertexPosition(
        this.draggedVertexInfo.lineId,
        this.draggedVertexInfo.vertexIndex,
        cartesian
      );
      return true;
    }

    return false;
  }

  handleHover(position: Cesium.Cartesian2): { cursor: string; handled: boolean } {
    if (!this.viewer) return { cursor: 'default', handled: false };

    // Show grabbing cursor while dragging
    if (this.isDraggingVertex) {
      this.removeHoverPreviewVertex();
      return { cursor: 'grabbing', handled: true };
    }

    // Priority 1: Check if near a vertex marker (grab cursor takes priority)
    if (this.isNearVertexMarker(position)) {
      this.removeHoverPreviewVertex();
      return { cursor: 'grab', handled: true };
    }

    // Priority 2: Check if near a line segment (crosshair cursor for vertex insertion)
    // This is checked after vertex markers to avoid flickering
    const previewInfo = this.checkLineSegmentHover(position);
    if (previewInfo) {
      this.showHoverPreviewVertex(previewInfo.position);
      return { cursor: 'crosshair', handled: true };
    }

    // Not hovering over anything interactive
    this.removeHoverPreviewVertex();
    return { cursor: 'default', handled: false };
  }

  handleLeftUp(position?: Cesium.Cartesian2): boolean {
    if (this.viewer) {
      this.viewer.scene.screenSpaceCameraController.enableInputs = true;
    }

    // Handle vertex drag end
    if (this.isDraggingVertex && this.draggedVertexInfo) {
      // Only call finishVertexDrag if preview was actually started (i.e., mouse moved)
      if (this.hasStartedDragPreview) {
        this.finishVertexDrag();
      }
      this.isDraggingVertex = false;
      this.draggedVertexInfo = null;
      this.hasStartedDragPreview = false;

      return true;
    }

    return false;
  }

  handleRightClick(position: Cesium.Cartesian2): boolean {
    if (!this.viewer) return false;

    const pickedObject = this.viewer.scene.pick(position);
    if (!Cesium.defined(pickedObject) || !(pickedObject.id instanceof Cesium.Entity)) return false;

    const entity = pickedObject.id as Cesium.Entity;

    // Check if it's a vertex marker
    if (!entity.properties || !entity.properties.hasProperty('_isVertexMarker')) return false;

    const isVertexMarker = entity.properties.getValue(Cesium.JulianDate.now())._isVertexMarker;
    if (!isVertexMarker) return false;

    const vertexInfo = entity.properties.getValue(Cesium.JulianDate.now())._vertexInfo;
    this.deleteVertex(vertexInfo.lineId, vertexInfo.vertexIndex);
    return true;
  }

  destroy() {
    // Clean up hover preview vertex
    this.removeHoverPreviewVertex();

    // Clean up all vertex markers
    this.lineVertexMarkers.forEach((markers, lineId) => {
      this.removeVertexMarkersForLine(lineId);
    });

    // Clean up vertex drag preview if it exists
    if (this.vertexDragPolylineCollection && this.viewer) {
      this.viewer.scene.primitives.remove(this.vertexDragPolylineCollection);
      this.vertexDragPolylineCollection = null;
      this.vertexDragPreviewLine = null;
    }
  }
}
