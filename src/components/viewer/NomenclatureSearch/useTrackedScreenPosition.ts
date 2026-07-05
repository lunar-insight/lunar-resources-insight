import { useEffect, useRef } from 'react';
import * as Cesium from 'cesium';

export const useTrackedScreenPosition = (
  viewer: Cesium.Viewer,
  lon: number,
  lat: number,
  elementRef: React.RefObject<HTMLElement>,
  anchorTransform: string
): void => {
  const groundPositionRef = useRef<Cesium.Cartesian3>(Cesium.Cartesian3.fromDegrees(lon, lat, 0));

  useEffect(() => {
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

    // Resolves the true terrain height directly from terrain tile data, once 
    // (deliberately not scene.clampToHeight that shifts
    // with camera parallax whenever the guessed height differs from the real
    // one, worse the more oblique/zoomed the view. Sampling the terrain tile
    // itself is independent of the camera entirely).
    Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [Cesium.Cartographic.fromDegrees(lon, lat)])
      .then(([sampled]) => {
        if (cancelled) return;
        if (sampled.height === undefined) {
          console.warn('[NomenclatureSearch] Terrain sample returned no height for', lon, lat);
          return;
        }
        groundPositionRef.current = Cesium.Cartesian3.fromRadians(
          sampled.longitude,
          sampled.latitude,
          sampled.height
        );
        update();
      })
      .catch((error) => {
        // Ellipsoid-surface fallback already in groundPositionRef
        console.warn('[NomenclatureSearch] Failed to sample terrain height for', lon, lat, error);
      });

    update();
    viewer.scene.postRender.addEventListener(update);
    return () => {
      cancelled = true;
      viewer.scene.postRender.removeEventListener(update);
    };
  }, [viewer, lon, lat, elementRef, anchorTransform]);
};
