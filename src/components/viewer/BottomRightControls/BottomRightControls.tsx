import React from 'react';
import * as Cesium from 'cesium';
import ZoomInButton from '../ZoomInButton/ZoomInButton';
import ZoomOutButton from '../ZoomOutButton/ZoomOutButton';
import FullscreenButton from '../FullscreenButton/FullscreenButton';
import styles from './BottomRightControls.module.scss';

interface BottomRightControlsProps {
  viewer: Cesium.Viewer | null;
}

const BottomRightControls: React.FC<BottomRightControlsProps> = ({ viewer }) => {
  return (
    <div className={styles.bottomRightControls}>
      <ZoomInButton viewer={viewer} />
      <ZoomOutButton viewer={viewer} />
      <div className={styles.spacer} />
      <FullscreenButton />
    </div>
  );
};

export default BottomRightControls;
