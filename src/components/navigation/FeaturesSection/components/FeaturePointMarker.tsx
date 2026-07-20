import React, { useCallback, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useTrackedScreenPosition } from 'hooks/useTrackedScreenPosition';
import { useFeaturesContext } from 'utils/context/FeaturesContext';
import { Feature } from '../types';
import styles from './FeaturePointMarker.module.scss';

interface FeaturePointMarkerProps {
  viewer: Cesium.Viewer;
  feature: Feature;
}

// Rendered as a DOM overlay rather than a Cesium point entity, since
// CLAMP_TO_GROUND entities are unreliable to render and pick on complex
// terrain (visual flicker, a "grab" hover cursor that fails to register).
// Dragging is implemented with native pointer events instead of
// scene.pick() for the same reason.
const FeaturePointMarker: React.FC<FeaturePointMarkerProps> = ({ viewer, feature }) => {
  const { activeDrawingTool, showFeatures, showLabels, updateFeaturePosition } = useFeaturesContext();
  const elementRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const position = feature.metadata.position ?? null;

  const lon = position ? Cesium.Math.toDegrees(position.longitude) : 0;
  const lat = position ? Cesium.Math.toDegrees(position.latitude) : 0;
  // Disabled while dragging: the hook's own per-frame position update would
  // otherwise conflict with the drag handler's live transform update on
  // every rendered frame.
  useTrackedScreenPosition(viewer, lon, lat, elementRef, 'translate(-50%, -50%)', !isDragging);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    // Don't steal the point out from under an in-progress drawing operation.
    if (activeDrawingTool || !position) return;

    event.stopPropagation();
    event.preventDefault();
    setIsDragging(true);

    const startCartesian = Cesium.Cartesian3.fromRadians(position.longitude, position.latitude, position.height);
    const normal = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(startCartesian, new Cesium.Cartesian3());
    const plane = Cesium.Plane.fromPointNormal(startCartesian, normal);

    const element = elementRef.current;
    let lastWorldPosition: Cesium.Cartesian3 | null = null;

    viewer.scene.screenSpaceCameraController.enableInputs = false;
    if (element) element.style.cursor = 'grabbing';

    // requestRenderMode is on globally, so Cesium only re-renders on camera
    // changes or explicit requests. A stationary-camera drag triggers
    // neither, so this must be disabled to keep the projection math the
    // drag depends on from going stale between frames (PointValueService
    // has the same requirement for its own live interaction).
    const previousRequestRenderMode = viewer.scene.requestRenderMode;
    viewer.scene.requestRenderMode = false;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const rect = viewer.canvas.getBoundingClientRect();
      const screenPosition = new Cesium.Cartesian2(moveEvent.clientX - rect.left, moveEvent.clientY - rect.top);
      const ray = viewer.camera.getPickRay(screenPosition);
      if (!ray) return;

      const worldPosition = Cesium.IntersectionTests.rayPlane(ray, plane);
      if (!worldPosition) return;
      lastWorldPosition = worldPosition;

      // Updates the DOM directly rather than through React state, keeping
      // this frame-perfect with Cesium's own render instead of trailing
      // behind React's scheduling (same reasoning as useTrackedScreenPosition).
      if (element) {
        const screen = viewer.scene.cartesianToCanvasCoordinates(worldPosition);
        if (screen) {
          element.style.transform = `translate(${screen.x}px, ${screen.y}px) translate(-50%, -50%)`;
        }
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      viewer.scene.requestRenderMode = previousRequestRenderMode;
      if (element) element.style.cursor = 'grab';
      setIsDragging(false);

      if (!lastWorldPosition) return;

      const ellipsoid = viewer.scene.globe.ellipsoid;
      const approxCartographic = ellipsoid.cartesianToCartographic(lastWorldPosition);
      updateFeaturePosition(feature.id, approxCartographic);

      // The plane-intersected drop position is only approximate; refine it
      // with the real terrain height once resolved, since accurate height
      // matters for camera framing when later jumping to this feature.
      Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.clone(approxCartographic)])
        .then(([sampled]) => {
          if (sampled.height === undefined) return;
          updateFeaturePosition(feature.id, new Cesium.Cartographic(sampled.longitude, sampled.latitude, sampled.height));
        })
        .catch(() => {
          // Approximate position from the drop is retained as the fallback.
        });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [activeDrawingTool, position, viewer, feature.id, updateFeaturePosition]);

  if (!position) return null;

  const shouldShowDot = showFeatures && feature.visible;

  return (
    <div
      ref={elementRef}
      className={styles.featurePointMarker}
      style={{ display: 'none', cursor: activeDrawingTool ? 'default' : 'grab' }}
      onPointerDown={handlePointerDown}
    >
      <span
        className={styles.dot}
        style={{ display: shouldShowDot ? 'block' : 'none', backgroundColor: feature.color }}
      />
      {shouldShowDot && showLabels && (
        <span className={styles.label}>{feature.name}</span>
      )}
    </div>
  );
};

export default FeaturePointMarker;
