import { useEffect, useState } from "react";
import { useViewer } from "utils/context/ViewerContext";

interface CameraHeight {
  height: number | null;
}

export const useCesiumCameraHeight = (): CameraHeight => {
  const { viewer } = useViewer();
  const [cameraHeight, setCameraHeight] = useState<CameraHeight>({
    height: null,
  });

  useEffect(() => {
    if (!viewer) return;

    const updateCameraHeight = () => {
      const cartographic = viewer.camera.positionCartographic;
      const height = cartographic.height;
      setCameraHeight({ height });
    };

    // Initialize with current height
    updateCameraHeight();

    // Update on camera movement
    const removeListener = viewer.camera.changed.addEventListener(updateCameraHeight);

    // Cleanup
    return () => {
      removeListener();
    };
  }, [viewer]);

  return cameraHeight;
};
