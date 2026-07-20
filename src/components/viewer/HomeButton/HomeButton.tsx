import React from 'react';
import { useViewer } from 'utils/context/ViewerContext';
import ViewerIconButton from 'components/layout/Button/ViewerIconButton/ViewerIconButton';

const HomeButton: React.FC = () => {
  const { viewer } = useViewer();

  const handleHomeClick = () => {
    if (!viewer) return;
    viewer.camera.flyHome();
  };

  return (
    <ViewerIconButton
      icon="home"
      ariaLabel="Reset to home view"
      tooltipText="Reset to home view"
      tooltipPlacement="left"
      onPress={handleHomeClick}
    />
  );
};

export default HomeButton;
