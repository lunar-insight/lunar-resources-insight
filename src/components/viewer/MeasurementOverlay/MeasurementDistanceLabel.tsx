import React, { useRef } from 'react';
import * as Cesium from 'cesium';
import { useTrackedScreenPosition } from 'hooks/useTrackedScreenPosition';
import { formatDistance } from 'utils/formatDistance';
import styles from './MeasurementDistanceLabel.module.scss';

interface MeasurementDistanceLabelProps {
  viewer: Cesium.Viewer;
  cartographic: Cesium.Cartographic;
  distanceMeters: number | null;
  isLoading: boolean;
}

const MeasurementDistanceLabel: React.FC<MeasurementDistanceLabelProps> = ({
  viewer,
  cartographic,
  distanceMeters,
  isLoading,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);

  const lon = Cesium.Math.toDegrees(cartographic.longitude);
  const lat = Cesium.Math.toDegrees(cartographic.latitude);
  useTrackedScreenPosition(viewer, lon, lat, elementRef, 'translate(-50%, -100%)', true, cartographic.height);

  const valueText = distanceMeters === null ? 'Calculating...' : formatDistance(distanceMeters);

  return (
    <div ref={elementRef} className={styles.measurementDistanceLabel}>
      <span className={styles.value}>
        {valueText}
        {isLoading && distanceMeters !== null && <span className={styles.updating}>updating...</span>}
      </span>
    </div>
  );
};

export default MeasurementDistanceLabel;
