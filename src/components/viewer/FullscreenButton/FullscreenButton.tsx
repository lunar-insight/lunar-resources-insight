import React, { useState, useEffect } from 'react';
import { Button } from 'react-aria-components';
import styles from './FullscreenButton.module.scss';

const FullscreenButton: React.FC = () => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  return (
    <div className={styles.fullscreenButtonContainer}>
      <Button
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
        className={styles.fullscreenButton}
        onPress={toggleFullscreen}
      >
        <span className={`material-symbols-outlined ${styles.icon}`}>
          {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
        </span>
      </Button>
    </div>
  );
};

export default FullscreenButton;
