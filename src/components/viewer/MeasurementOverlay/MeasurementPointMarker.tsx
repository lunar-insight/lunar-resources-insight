import React, { useCallback, useId, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { useTrackedBeaconLine } from 'hooks/useTrackedBeaconLine';
import { computeBeaconTopPosition, applyBeaconProjection } from 'utils/beaconGeometry';
import { DrawingUtils } from 'services/drawing/DrawingUtils';
import styles from './MeasurementPointMarker.module.scss';

interface MeasurementPointMarkerProps {
  viewer: Cesium.Viewer;
  cartographic: Cesium.Cartographic;
  onDragMove: (liveCartesian: Cesium.Cartesian3) => void;
  onDragEnd: (finalCartesian: Cesium.Cartesian3) => void;
}

// DOM overlay, not a Cesium point entity: CLAMP_TO_GROUND entities are
// unreliable to render and pick on complex terrain, the same problem
// FeaturePointMarker's own DOM overlay works around. Rendered as a beacon
// line, both endpoints (ground point and an offset point along the local
// surface normal) are projected to screen space independently each frame,
// so it tilts and foreshortens with camera angle.
const MeasurementPointMarker: React.FC<MeasurementPointMarkerProps> = ({
  viewer,
  cartographic,
  onDragMove,
  onDragEnd,
}) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hitTargetRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const gradientId = useId();
  const [isDragging, setIsDragging] = useState(false);

  useTrackedBeaconLine(viewer, cartographic, wrapperRef, lineRef, !isDragging);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    event.preventDefault();
    setIsDragging(true);

    const startCartesian = Cesium.Cartesian3.fromRadians(cartographic.longitude, cartographic.latitude, cartographic.height);
    const normal = viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(startCartesian, new Cesium.Cartesian3());
    const plane = Cesium.Plane.fromPointNormal(startCartesian, normal);

    const wrapper = wrapperRef.current;
    const line = lineRef.current;
    let lastWorldPosition: Cesium.Cartesian3 | null = null;

    viewer.scene.screenSpaceCameraController.enableInputs = false;
    if (hitTargetRef.current) hitTargetRef.current.style.cursor = 'grabbing';

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

      if (wrapper && line) {
        const groundScreen = viewer.scene.cartesianToCanvasCoordinates(worldPosition);
        const topCartesian = computeBeaconTopPosition(viewer, worldPosition);
        const topScreen = viewer.scene.cartesianToCanvasCoordinates(topCartesian);
        applyBeaconProjection(wrapper, line, groundScreen, topScreen);
      }

      onDragMove(worldPosition);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      viewer.scene.screenSpaceCameraController.enableInputs = true;
      viewer.scene.requestRenderMode = previousRequestRenderMode;
      if (hitTargetRef.current) hitTargetRef.current.style.cursor = 'grab';
      setIsDragging(false);

      if (!lastWorldPosition) return;

      const rect = viewer.canvas.getBoundingClientRect();
      const dropScreenPosition = new Cesium.Cartesian2(upEvent.clientX - rect.left, upEvent.clientY - rect.top);
      const dropCartesian = DrawingUtils.pickGlobePosition(viewer, dropScreenPosition) ?? lastWorldPosition;

      onDragEnd(dropCartesian);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [viewer, cartographic, onDragMove, onDragEnd]);

  return (
    <div ref={wrapperRef} className={styles.measurementPointMarker}>
      <div ref={hitTargetRef} className={styles.hitTarget} onPointerDown={handlePointerDown} />
      <svg className={styles.beaconSvg}>
        <defs>
          {/*
            objectBoundingBox coordinates track the line's own bounding box,
            so this stays aligned with the line regardless of its on-screen
            tilt. Assumes the top point projects above the ground point on
            screen; at extreme camera angles where "up" projects downward,
            the fade direction can appear inverted.
          */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#00FFFF" stopOpacity="0" />
            <stop offset="1" stopColor="#00FFFF" stopOpacity="0.95" />
          </linearGradient>
        </defs>
        <line ref={lineRef} x1="0" y1="0" x2="0" y2="0" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
        <circle className={styles.capRing} cx="0" cy="0" r="4" />
      </svg>
    </div>
  );
};

export default MeasurementPointMarker;
