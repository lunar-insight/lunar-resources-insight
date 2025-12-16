import React, { useRef } from 'react';
import { Button, TooltipTrigger } from 'react-aria-components';
import { ButtonTooltip } from '../../layout/Tooltip/ButtonTooltip';
import { useViewer } from '../../../utils/context/ViewerContext';
import styles from './HelpButton.module.scss';

const HelpButton: React.FC = () => {
  const { viewer } = useViewer();
  const isTogglingRef = useRef(false);

  const handleHelpClick = () => {
    if (!viewer) return;
    if (isTogglingRef.current) return;

    if (viewer.navigationHelpButton && viewer.navigationHelpButton.viewModel) {
      isTogglingRef.current = true;

      // Check if the help panel is actually visible in the DOM
      const helpContainer = document.querySelector('.cesium-navigation-help');
      const isActuallyVisible = helpContainer &&
        window.getComputedStyle(helpContainer).display !== 'none' &&
        window.getComputedStyle(helpContainer).visibility !== 'hidden';

      // Toggle based on actual visibility, not observable value
      const newState = !isActuallyVisible;

      // Use setTimeout to ensure the state change happens after any other events
      setTimeout(() => {
        const viewModel = viewer.navigationHelpButton.viewModel;

        // Set new state (call as function for Knockout observable)
        if (typeof viewModel.showInstructions === 'function') {
          (viewModel.showInstructions as any)(newState);
        } else {
          (viewModel as any).showInstructions = newState;
        }

        // Allow toggling again after a short delay
        setTimeout(() => {
          isTogglingRef.current = false;
        }, 100);
      }, 0);
    }
  };

  return (
    <TooltipTrigger>
      <Button
        aria-label="Show navigation help"
        className={styles.helpButton}
        onPress={handleHelpClick}
      >
        <span className={`material-symbols-outlined ${styles.icon}`}>
          help
        </span>
      </Button>
      <ButtonTooltip placement="bottom">
        Show navigation help
      </ButtonTooltip>
    </TooltipTrigger>
  );
};

export default HelpButton;
