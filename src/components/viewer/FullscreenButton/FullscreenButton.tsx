import React, { useState, useEffect } from 'react';
import ViewerIconButton from '../../layout/Button/ViewerIconButton/ViewerIconButton';

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
    <ViewerIconButton
      icon={isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
      ariaLabel={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      tooltipText={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      tooltipPlacement="left"
      onPress={toggleFullscreen}
    />
  );
};

export default FullscreenButton;
