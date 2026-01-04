import React from 'react';
import styles from './TopBar.module.scss';
import TopBarButton from 'components/layout/Button/TopBarButton/TopBarButton';
import { useSidebarContext } from 'utils/context/SidebarContext';

export interface TopBarProps {
  children?: React.ReactNode;
  className?: string;
}

const TopBar: React.FC<TopBarProps> = ({ children, className = '' }) => {
  const { isSidebarOpen } = useSidebarContext();
  const sidebarWidth = 400;

  return (
    <div
      className={`${styles.topBar} ${className}`}
      style={{
        '--topbar-left': isSidebarOpen ? `calc(5rem + ${sidebarWidth}px)` : '5rem'
      } as React.CSSProperties}
    >
      <div className={styles.leftSection}>
        <span className={styles.selectionText}>Selection</span>
        <div className={styles.drawGroup}>
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
        <div className={styles.separator}></div>
        <span className={styles.selectionText}>Measurement</span>
        <div className={styles.measurementGroup}>
          <TopBarButton
            icon="straighten"
            ariaLabel='Line Measurement Tool'
            tooltipText='Line measurement'
            onPress={() => {}}
            tooltipPlacement='bottom'
            isSelected={false}
          />
          <TopBarButton
            icon="square_foot"
            ariaLabel='Area Measurement Tool'
            tooltipText='Area measurement'
            onPress={() => {}}
            tooltipPlacement='bottom'
            isSelected={false}
          />
        </div>
        <div className={styles.separator}></div>
        <span className={styles.selectionText}>Annotation</span>
        <TopBarButton
          icon="distance"
          ariaLabel='Text Annotation Tool'
          tooltipText='Text annotation'
          onPress={() => {}}
          tooltipPlacement='bottom'
          isSelected={false}
        />
        {children}
      </div>
      <div className={styles.centerSection}></div>
      <div className={styles.rightSection}></div>
    </div>
  );
};

export default TopBar;
