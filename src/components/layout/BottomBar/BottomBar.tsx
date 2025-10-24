import React from 'react';
import styles from './BottomBar.module.scss';
import CoordinatesDisplay from 'components/ui/CoordinatesDisplay/CoordinatesDisplay';
import { useCesiumMousePosition } from 'hooks/useCesiumMousePosition';

export interface BottomBarProps {
  children?: React.ReactNode;
  className?: string;
}

const BottomBar: React.FC<BottomBarProps> = ({ children, className = '' }) => {
  const { latitude, longitude, isVisible } = useCesiumMousePosition();
  
  return (
    <div className={`${styles.bottomBar} ${className}`}>
      <div className={styles.leftSection}>{children}</div>
      <div className={styles.centerSection}>
        <CoordinatesDisplay
          latitude={latitude}
          longitude={longitude}
          isVisible={isVisible}
        />
      </div>
      <div className={styles.rightSection}></div>
    </div>
  );
};

export default BottomBar;