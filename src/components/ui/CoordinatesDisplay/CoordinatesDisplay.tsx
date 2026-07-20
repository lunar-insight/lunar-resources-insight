import React from "react";
import styles from './CoordinatesDisplay.module.scss';

export interface CoordinatesDisplayProps {
  latitude: number | null;
  longitude: number | null;
  isVisible: boolean;
}

const CoordinatesDisplay: React.FC<CoordinatesDisplayProps> = ({
  latitude,
  longitude,
  isVisible,
}) => {
  const formatLatitude = (value: number): string => {
    // 90° to -90°
    return value.toFixed(6) + '°'
  };

  const formatLongitude = (value: number): string => {
    // 0 to 360°
    const normalizedLon = value < 0 ? value + 360 : value;
    return normalizedLon.toFixed(6) + '°'
  };

  if (!isVisible || latitude === null || longitude === null) {
    return null;
  }

  return (
    <div className={styles.coordinatesDisplay}>
      <span className={styles.coordinate}>
        <span className={styles.label}>Lat:</span>
        <span className={styles.value}>{formatLatitude(latitude)}</span>
      </span>
      <span className={styles.separator}>|</span>
      <span className={styles.coordinate}>
        <span className={styles.label}>Lon:</span>
        <span className={styles.value}>{formatLongitude(longitude)}</span>
      </span>
    </div>
  );
};

export default CoordinatesDisplay;