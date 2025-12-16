import React from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../layout/Tooltip/ButtonTooltip';
import { useViewer } from '../../../utils/context/ViewerContext';
import styles from './HomeButton.module.scss';

const HomeButton: React.FC = () => {
  const { viewer } = useViewer();

  const handleHomeClick = () => {
    if (!viewer) return;
    viewer.camera.flyHome();
  };

  return (
    <TooltipTrigger>
      <Button
        aria-label="Reset to home view"
        className={styles.homeButton}
        onPress={handleHomeClick}
      >
        <span className={`material-symbols-outlined ${styles.icon}`}>
          home
        </span>
      </Button>
      <ButtonTooltip placement="bottom">
        Reset to home view
      </ButtonTooltip>
    </TooltipTrigger>
  );
};

export default HomeButton;
