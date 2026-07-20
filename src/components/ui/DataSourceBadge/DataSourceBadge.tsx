import React from 'react';
import { DataAvailability } from 'types/dataSource';
import styles from './DataSourceBadge.module.scss';

export interface DataSourceBadgeProps {
  dataType: DataAvailability;
  className?: string;
  iconOnly?: boolean;
}

/**
 * Reusable badge component for displaying data source tags
 * Shows whether data is from satellite mapping, ground samples, or both
 * @param iconOnly = If true, shows only the emoji without background/border (for small spaces like PeriodicTable)
 */
export const DataSourceBadge: React.FC<DataSourceBadgeProps> = ({ dataType, className, iconOnly = false }) => {
  const getBadgeClass = () => {
    switch (dataType) {
      case 'map+ground':
        return styles.badgeGlobal;
      case 'map':
        return styles.badgeMap;
      case 'ground':
        return styles.badgeLocal;
    }
  };

  const getBadgeEmoji = () => {
    switch (dataType) {
      case 'map+ground':
        return '🗺️';
      case 'map':
        return '🛰️';
      case 'ground':
        return '📍';
    }
  };

  return (
    <span className={`${iconOnly ? styles.badgeIconOnly : `${styles.badge} ${getBadgeClass()}`} ${className || ''}`}>
      {getBadgeEmoji()}
    </span>
  );
};
