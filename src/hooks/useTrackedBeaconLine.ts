import { useEffect } from 'react';
import * as Cesium from 'cesium';
import { computeBeaconTopPosition, applyBeaconProjection } from 'utils/beaconGeometry';

// Keeps a beacon-line DOM overlay (a wrapper positioned at the ground point,
// containing an SVG line pointing at the offset top point) pinned to a
// cartographic position, refreshed on every Cesium render. Both endpoints
// are real 3D points projected independently each frame, so the line tilts
// and foreshortens with camera angle.
export const useTrackedBeaconLine = (
  viewer: Cesium.Viewer,
  cartographic: Cesium.Cartographic,
  wrapperRef: React.RefObject<HTMLElement>,
  lineRef: React.RefObject<SVGLineElement>,
  enabled: boolean = true
): void => {
  useEffect(() => {
    if (!enabled) return;

    const groundCartesian = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      cartographic.height
    );

    const update = () => {
      const wrapper = wrapperRef.current;
      const line = lineRef.current;
      if (!wrapper || !line) return;

      const groundScreen = viewer.scene.cartesianToCanvasCoordinates(groundCartesian);
      const topCartesian = computeBeaconTopPosition(viewer, groundCartesian);
      const topScreen = viewer.scene.cartesianToCanvasCoordinates(topCartesian);

      applyBeaconProjection(wrapper, line, groundScreen, topScreen);
    };

    update();
    viewer.scene.postRender.addEventListener(update);
    return () => {
      viewer.scene.postRender.removeEventListener(update);
    };
  }, [viewer, cartographic, wrapperRef, lineRef, enabled]);
};
