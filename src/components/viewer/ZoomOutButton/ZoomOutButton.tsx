import React from 'react';
import * as Cesium from 'cesium';
import ViewerIconButton from '../../layout/Button/ViewerIconButton/ViewerIconButton';

interface ZoomOutButtonProps {
  viewer: Cesium.Viewer | null;
}

const ZoomOutButton: React.FC<ZoomOutButtonProps> = ({ viewer }) => {
  const handleZoomOut = () => {
    if (!viewer) return;

    const camera = viewer.camera;
    const cartographic = camera.positionCartographic;
    const currentHeight = cartographic.height;
    const newHeight = currentHeight * 2.0; // Zoom out by 100%

    // Get the point on the surface directly below the camera
    const destination = Cesium.Cartesian3.fromRadians(
      cartographic.longitude,
      cartographic.latitude,
      newHeight
    );

    camera.flyTo({
      destination,
      orientation: {
        heading: camera.heading,
        pitch: camera.pitch,
        roll: camera.roll,
      },
      duration: 0.5,
      easingFunction: Cesium.EasingFunction.CUBIC_OUT,
    });
  };

  return (
    <ViewerIconButton
      label="-"
      ariaLabel="Zoom out"
      tooltipText="Zoom out"
      tooltipPlacement="left"
      onPress={handleZoomOut}
    />
  );
};

export default ZoomOutButton;
