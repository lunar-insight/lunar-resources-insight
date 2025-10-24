import { useEffect, useState } from "react";
import * as Cesium from 'cesium';
import { useViewer } from "utils/context/ViewerContext";

interface MousePosition {
  latitude: number | null;
  longitude: number | null;
  isVisible: boolean;
}

export const useCesiumMousePosition = (): MousePosition => {
  const { viewer } = useViewer();
  const [position, setPosition] = useState<MousePosition>({
    latitude: null,
    longitude: null,
    isVisible: false,
  });

  useEffect(() => {
    if (!viewer) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Mouse movement manager
    handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.MotionEvent) => {
      const cartesian = viewer.camera.pickEllipsoid(
        movement.endPosition,
        viewer.scene.globe.ellipsoid
      );

      if (cartesian) {
        // Convert to geographic coordinates
        const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
        const latitude = Cesium.Math.toDegrees(cartographic.latitude);
        const longitude = Cesium.Math.toDegrees(cartographic.longitude);

        setPosition({
          latitude,
          longitude,
          isVisible: true,
        });
      } else {
        // Cursor outside the globe
        setPosition((prev) => ({
          ...prev,
          isVisible: false,
        }));
      }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // Cleanup
    return () => {
      handler.destroy();
    };
  }, [viewer]);

  return position;
};