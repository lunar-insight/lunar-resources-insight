import React from 'react';
import styles from './TopBar.module.scss';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';

export interface TopBarProps {
  children?: React.ReactNode;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ children, className = '' }) => {
  return (
    <div className={`${styles.topBar} ${className}`}>
      <div className={styles.leftSection}>
        <div className={styles.buttonGroup}>
          <ViewerIconButton
            icon="point_scan"
            ariaLabel="Point Selection Tool"
            tooltipText="Select points"
            onPress={() => {}}
            tooltipPlacement="bottom"
          />
          <ViewerIconButton
            icon="diagonal_line"
            ariaLabel="Line Drawing Tool"
            tooltipText="Draw lines"
            onPress={() => {}}
            tooltipPlacement="bottom"
          />
          <ViewerIconButton
            icon="hexagon"
            ariaLabel="Polygon Drawing Tool"
            tooltipText="Draw polygons"
            onPress={() => {}}
            tooltipPlacement="bottom"
          />
        </div>
        {children}
      </div>
      <div className={styles.centerSection}></div>
      <div className={styles.rightSection}></div>
    </div>
  );
};

export default TopBar;
