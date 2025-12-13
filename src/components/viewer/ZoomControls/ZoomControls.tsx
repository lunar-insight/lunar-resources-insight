import React from 'react';
import * as Cesium from 'cesium';
import { Button } from 'react-aria-components';
import styles from './ZoomControls.module.scss';

interface ZoomControlsProps {
  viewer: Cesium.Viewer | null;
}

const ZoomControls: React.FC<ZoomControlsProps> = ({ viewer }) => {
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
    <div className={styles.zoomControls}>
      <Button
        aria-label="Zoom in"
        className={styles.zoomButton}
        onPress={handleZoomIn}
      >
        +
      </Button>
      <Button
        aria-label="Zoom out"
        className={styles.zoomButton}
        onPress={handleZoomOut}
      >
        -
      </Button>
    </div>
  );
};

export default ZoomControls;
