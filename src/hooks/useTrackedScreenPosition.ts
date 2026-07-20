import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

// Positions a DOM element (via elementRef) at the screen projection of a
// given lon/lat, refreshed on every Cesium render. Implemented as a plain
// DOM overlay rather than a Cesium entity, since CLAMP_TO_GROUND entities
// are unreliable to render and pick on complex terrain (flicker, missed
// picks), whereas screen-space math plus native browser hit-testing is not.
export const useTrackedScreenPosition = (
  viewer: Cesium.Viewer,
  lon: number,
  lat: number,
  elementRef: React.RefObject<HTMLElement>,
  anchorTransform: string,
  // Lets a consumer that's driving its own live updates (e.g. an active drag)
  // fully pause this hook, rather than have both write to element.style on
  // every rendered frame and fight each other.
  enabled: boolean = true
): void => {
  const groundPositionRef = useRef<Cesium.Cartesian3>(Cesium.Cartesian3.fromDegrees(lon, lat, 0));

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    groundPositionRef.current = Cesium.Cartesian3.fromDegrees(lon, lat, 0);

    const update = () => {
      const element = elementRef.current;
      if (!element) return;

      const screen = viewer.scene.cartesianToCanvasCoordinates(groundPositionRef.current);
      if (!screen) {
        element.style.display = 'none';
        return;
      }
      element.style.display = '';
      element.style.transform = `translate(${screen.x}px, ${screen.y}px) ${anchorTransform}`;
    };

    // Resolves the true terrain height directly from terrain tile data,
    // once. Not scene.clampToHeight, which shifts with camera parallax
    // whenever the guessed height differs from the real one, worse at
    // oblique or zoomed views; sampling the terrain tile itself is
    // independent of the camera.
    Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)])
      .then(([sampled]) => {
        if (cancelled || sampled.height === undefined) return;
        groundPositionRef.current = Cesium.Cartesian3.fromRadians(
          sampled.longitude,
          sampled.latitude,
          sampled.height
        );
        update();
      })
      .catch(() => {
        // Ellipsoid-surface fallback already in groundPositionRef.
      });

    update();
    viewer.scene.postRender.addEventListener(update);
    return () => {
      cancelled = true;
      viewer.scene.postRender.removeEventListener(update);
    };
  }, [viewer, lon, lat, elementRef, anchorTransform, enabled]);
};
