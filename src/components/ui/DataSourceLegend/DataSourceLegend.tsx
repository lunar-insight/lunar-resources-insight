import React from 'react';
import styles from './DataSourceLegend.module.scss';

export interface DataSourceLegendProps {
  className?: string;
}

/**
 * Reusable legend component showing data source tag meanings
 * Displays the three types of data availability with their corresponding badges
 */
export const DataSourceLegend: React.FC<DataSourceLegendProps> = ({ className }) => {
  return (
    <div className={`${styles.legend} ${className || ''}`}>
      <div className={styles.legendItem}>
        <span className={`${styles.badgeMini} ${styles.badgeMiniMapGround}`}>🗺️</span>
        <span>Map + Ground</span>
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.badgeMini} ${styles.badgeMiniMap}`}>🛰️</span>
        <span>Map only</span>
      </div>
      <div className={styles.legendItem}>
        <span className={`${styles.badgeMini} ${styles.badgeMiniGround}`}>📍</span>
        <span>Ground only</span>
      </div>
    </div>
  );
};
