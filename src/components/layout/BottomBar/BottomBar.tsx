import React from 'react';
import styles from './BottomBar.module.scss';
import CoordinatesDisplay from 'components/ui/CoordinatesDisplay/CoordinatesDisplay';
import ZoomLevelDisplay from 'components/ui/ZoomLevelDisplay/ZoomLevelDisplay';
import { useCesiumMousePosition } from 'hooks/useCesiumMousePosition';
import { useCesiumCameraHeight } from 'hooks/useCesiumCameraHeight';

export interface BottomBarProps {
  children?: React.ReactNode;
  className?: string;
}

const BottomBar: React.FC<BottomBarProps> = ({ children, className = '' }) => {
  const { latitude, longitude, isVisible } = useCesiumMousePosition();
  const { height } = useCesiumCameraHeight();

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
      <div className={styles.rightSection}>
        <ZoomLevelDisplay height={height} />
      </div>
    </div>
  );
};

export default BottomBar;