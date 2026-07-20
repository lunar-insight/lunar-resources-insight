import React from 'react';
import * as Cesium from 'cesium';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';

interface ZoomInButtonProps {
  viewer: Cesium.Viewer | null;
}

const ZoomInButton: React.FC<ZoomInButtonProps> = ({ viewer }) => {
  const handleZoomIn = () => {
    if (!viewer) return;

    const camera = viewer.camera;
    const cartographic = camera.positionCartographic;
    const currentHeight = cartographic.height;
    const newHeight = currentHeight * 0.5; // Zoom in by 50%

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
      label="+"
      ariaLabel="Zoom in"
      tooltipText="Zoom in"
      tooltipPlacement="left"
      onPress={handleZoomIn}
    />
  );
};

export default ZoomInButton;
