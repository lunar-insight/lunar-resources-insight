import React from "react";
import styles from './ZoomLevelDisplay.module.scss';

export interface ZoomLevelDisplayProps {
  height: number | null;
}

const ZoomLevelDisplay: React.FC<ZoomLevelDisplayProps> = ({ height }) => {
  const formatHeight = (value: number): string => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(2)} Mm`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} km`;
    } else {
      return `${value.toFixed(2)} m`;
    }
  };

  if (height === null) {
    return null;
  }

  return (
    <div className={styles.zoomLevelDisplay}>
      <span className={styles.coordinate}>
        <span className={styles.label}>Altitude:</span>
        <span className={styles.value}>{formatHeight(height)}</span>
      </span>
    </div>
  );
};

export default ZoomLevelDisplay;
