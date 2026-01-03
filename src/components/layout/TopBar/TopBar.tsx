import React from 'react';
import styles from './TopBar.module.scss';
import TopBarButton from 'components/layout/Button/TopBarButton/TopBarButton';

export interface TopBarProps {
  children?: React.ReactNode;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ children, className = '' }) => {
  return (
    <div className={`${styles.topBar} ${className}`}>
      <div className={styles.leftSection}>
        <div className={styles.buttonGroup}>
          <TopBarButton
            icon="point_scan"
            ariaLabel="Point Drawing Tool"
            tooltipText="Draw points"
            onPress={() => {}}
            tooltipPlacement="bottom"
            isSelected={false}
          />
          <TopBarButton
            icon="diagonal_line"
            ariaLabel="Line Drawing Tool"
            tooltipText="Draw lines"
            onPress={() => {}}
            tooltipPlacement="bottom"
            isSelected={false}
          />
          <TopBarButton
            icon="hexagon"
            ariaLabel="Polygon Drawing Tool"
            tooltipText="Draw polygons"
            onPress={() => {}}
            tooltipPlacement="bottom"
            isSelected={false}
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
